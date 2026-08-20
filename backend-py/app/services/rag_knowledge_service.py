import logging
import math
import os
import re
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.knowledge_base import CompanyDocument, CompanyDocumentChunk
from app.db.models.user import User
from app.services.ai_service import (
    cosine_similarity,
    extract_key_phrases,
    generate_vector_embedding,
    get_llm_completion,
    remove_em_dashes,
)

logger = logging.getLogger(__name__)


def _chunk_text_sentence_aware(
    text: str, target_chunk_size: int = 500, overlap: int = 60
) -> list[str]:
    """Splits document text into clean, sentence-aware semantic chunks."""
    cleaned = text.strip()
    if not cleaned:
        return []
    if len(cleaned) <= target_chunk_size:
        return [cleaned]

    sentences = re.split(r"(?<=[.!?\n])\s+", cleaned)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_length = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        sentence_len = len(sentence)

        if current_length + sentence_len > target_chunk_size and current_chunk:
            chunk_str = " ".join(current_chunk)
            chunks.append(chunk_str)

            overlap_chunk: list[str] = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) <= overlap:
                    overlap_chunk.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current_chunk = overlap_chunk
            current_length = overlap_len

        current_chunk.append(sentence)
        current_length += sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


async def create_company_document(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    title: str,
    category: str,
    content: str,
    file_path: str | None = None,
    file_type: str = "text",
) -> CompanyDocument:
    """Ingests a company policy document, chunks it semantically, and indexes vector embeddings."""
    title_str = remove_em_dashes(title.strip())
    content_str = remove_em_dashes(content.strip())

    if not title_str:
        raise AppError(400, "BAD_REQUEST", "Document title is required")
    if not content_str:
        raise AppError(400, "BAD_REQUEST", "Document content cannot be empty")

    try:
        doc = CompanyDocument(
            workspace_id=workspace_id,
            title=title_str,
            category=category.strip() or "General",
            file_path=file_path,
            file_type=file_type,
            created_by_id=user_id,
        )
        session.add(doc)
        await session.flush()

        raw_chunks = _chunk_text_sentence_aware(content_str)
        for idx, chunk_text in enumerate(raw_chunks):
            embedding_vec = generate_vector_embedding(chunk_text)
            chunk = CompanyDocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=chunk_text,
                embedding=embedding_vec,
                metadata_json={
                    "title": doc.title,
                    "category": doc.category,
                    "chunk_size": len(chunk_text),
                },
            )
            session.add(chunk)

        await session.commit()
        await session.refresh(doc)
        return doc
    except Exception as e:
        await session.rollback()
        logger.error(f"Error creating company document: {e}")
        raise AppError(500, "INTERNAL_SERVER_ERROR", f"Failed to save document: {e}")


async def list_company_documents(
    session: AsyncSession, workspace_id: str
) -> list[CompanyDocument]:
    """Lists all company policy documents in the workspace ordered by creation date."""
    try:
        return (
            await session.scalars(
                select(CompanyDocument)
                .where(CompanyDocument.workspace_id == workspace_id)
                .order_by(CompanyDocument.created_at.desc())
            )
        ).all()
    except Exception as e:
        logger.warning(f"Failed to list company documents (tables may be uninitialized): {e}")
        return []


async def delete_company_document(
    session: AsyncSession, workspace_id: str, document_id: str
) -> None:
    """Deletes a company policy document and cascades deletion of vector chunks."""
    try:
        doc = await session.get(CompanyDocument, document_id)
        if not doc or doc.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Document not found in active workspace")
        await session.delete(doc)
        await session.commit()
    except AppError:
        raise
    except Exception as e:
        await session.rollback()
        logger.error(f"Error deleting company document: {e}")
        raise AppError(500, "INTERNAL_SERVER_ERROR", f"Failed to delete document: {e}")


def _infer_action_chips(query: str, answer: str) -> list[dict[str, str]]:
    """Generates intelligent interactive action chips based on query domain."""
    q_lower = query.lower()
    chips: list[dict[str, str]] = []

    if any(w in q_lower for w in ["leave", "vacation", "holiday", "sick", "pto", "time off"]):
        chips.append({"label": "Contact HR Channel", "action": "open_channel", "target": "hr"})
        chips.append({"label": "View Leave Guidelines", "action": "open_doc", "target": "leave"})

    if any(w in q_lower for w in ["wifi", "vpn", "laptop", "it", "password", "security", "hardware"]):
        chips.append({"label": "Contact IT Support", "action": "open_channel", "target": "it-support"})
        chips.append({"label": "IT Security Checklist", "action": "open_doc", "target": "security"})

    if any(w in q_lower for w in ["reimburse", "expense", "receipt", "finance", "billing", "budget"]):
        chips.append({"label": "Submit Expense Claim", "action": "open_link", "target": "/settings"})

    return chips


async def query_company_knowledge_base(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    query: str,
    top_k: int = 4,
) -> dict[str, Any]:
    """Executes permission-aware vector RAG query against company documents."""
    query_str = remove_em_dashes(query.strip())
    if not query_str:
        raise AppError(400, "BAD_REQUEST", "Query string cannot be empty")

    query_vec = generate_vector_embedding(query_str)
    keywords = set(extract_key_phrases(query_str, max_phrases=8))

    chunks: list[CompanyDocumentChunk] = []
    try:
        stmt = (
            select(CompanyDocumentChunk)
            .options(selectinload(CompanyDocumentChunk.document))
            .join(CompanyDocument, CompanyDocumentChunk.document_id == CompanyDocument.id)
            .where(CompanyDocument.workspace_id == workspace_id)
        )
        chunks = (await session.scalars(stmt)).all()
    except Exception as e:
        logger.warning(f"Database table uninitialized or query failed in RAG knowledge search: {e}")
        chunks = []

    if not chunks:
        return {
            "query": query_str,
            "answer": "No company policy documents have been indexed yet. Workspace administrators can upload HR policies, IT guides, and SOPs in Workspace Settings.",
            "citations": [],
            "actionChips": _infer_action_chips(query_str, ""),
        }

    scored: list[tuple[float, CompanyDocumentChunk, CompanyDocument]] = []
    for chunk in chunks:
        doc = chunk.document
        if not doc:
            continue

        sim = cosine_similarity(query_vec, chunk.embedding or [])
        text_lower = chunk.content.lower()

        kw_hits = sum(1 for kw in keywords if kw in text_lower)
        keyword_boost = kw_hits * 0.12

        title_boost = 0.20 if any(kw in doc.title.lower() for kw in keywords) else 0.0

        total_score = sim + keyword_boost + title_boost
        scored.append((total_score, chunk, doc))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_results = scored[:top_k]

    if not top_results or top_results[0][0] < 0.08:
        return {
            "query": query_str,
            "answer": "I searched the company knowledge base, but couldn't find a direct policy matching your query. Please reach out to your HR or IT department for assistance.",
            "citations": [],
            "actionChips": _infer_action_chips(query_str, ""),
        }

    citations: list[dict[str, Any]] = []
    seen_doc_ids = set()
    retrieved_contexts: list[str] = []

    for score, chunk, doc in top_results:
        retrieved_contexts.append(f"Document Title: '{doc.title}' ({doc.category})\nContent: \"{chunk.content}\"")
        if doc.id not in seen_doc_ids:
            seen_doc_ids.add(doc.id)
            snippet = chunk.content[:180] + "..." if len(chunk.content) > 180 else chunk.content
            citations.append({
                "id": doc.id,
                "title": doc.title,
                "category": doc.category,
                "snippet": snippet,
            })

    rag_prompt = f"""User Policy Question: "{query_str}"

Retrieved Official Company Policy Contexts:
{"---".join(retrieved_contexts)}

Answer the user's question authoritatively based ONLY on the provided official policy contexts. DO NOT use em dashes. Mention the document titles cited."""
    llm_answer = await get_llm_completion(rag_prompt, system_instruction="You are an official Company Policy AI Assistant for Kinetix. Provide concise, authoritative answers.")

    if llm_answer:
        return {
            "query": query_str,
            "answer": remove_em_dashes(llm_answer),
            "citations": citations,
            "actionChips": _infer_action_chips(query_str, llm_answer),
        }

    top_chunk, top_doc = top_results[0][1], top_results[0][2]
    fallback_answer = (
        f"According to {top_doc.title} ({top_doc.category}):\n\n"
        f"{top_chunk.content}\n\n"
        f"*(Source: {top_doc.title})*"
    )

    return {
        "query": query_str,
        "answer": remove_em_dashes(fallback_answer),
        "citations": citations,
        "actionChips": _infer_action_chips(query_str, fallback_answer),
    }
