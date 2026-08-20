-- AI Knowledge Base tables for RAG vector search & policy document management

CREATE TABLE IF NOT EXISTS company_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    file_path VARCHAR(500),
    file_type VARCHAR(50) NOT NULL DEFAULT 'text',
    created_by_id TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_workspace_id ON company_documents(workspace_id);

CREATE TABLE IF NOT EXISTS company_document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
    chunk_index JSONB NOT NULL,
    content TEXT NOT NULL,
    embedding JSONB,
    metadata_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_company_document_chunks_document_id ON company_document_chunks(document_id);
