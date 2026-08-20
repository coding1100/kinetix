import logging
import math
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

# Stopwords set for text analysis
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves"
}


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Computes cosine similarity between two numeric vectors with dimension validation."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


def generate_vector_embedding(text: str, dim: int = 156) -> list[float]:
    """Generates a high-quality, normalized TF-IDF feature vector embedding for offline mode."""
    vec = [0.0] * dim
    words = [w for w in re.findall(r"\b[a-zA-Z0-9]{2,}\b", text.lower()) if w not in STOPWORDS]
    if not words:
        return vec

    # Term frequency hash projection
    for word in words:
        # Dual hash for feature distribution across dimensions
        h1 = abs(hash(word)) % dim
        h2 = abs(hash(word[::-1] + "_k")) % dim
        vec[h1] += 1.0
        vec[h2] += 0.5

    # Sublinear scaling & L2 normalization
    for i in range(dim):
        if vec[i] > 0:
            vec[i] = 1.0 + math.log(vec[i])

    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]

    return vec


def extract_key_phrases(text: str, max_phrases: int = 5) -> list[str]:
    """Extracts significant keywords and phrases from text using term frequency."""
    words = [w for w in re.findall(r"\b[a-zA-Z0-9]{3,}\b", text.lower()) if w not in STOPWORDS]
    freq: dict[str, int] = {}
    for word in words:
        freq[word] = freq.get(word, 0) + 1
    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [w[0] for w in sorted_words[:max_phrases]]


async def get_llm_completion(
    prompt: str,
    system_instruction: str = "You are an executive AI workspace assistant for Kinetix.",
) -> str | None:
    """Attempts completion using available LLM API providers (Gemini or OpenAI).
    Returns None if no API key is set or call fails, enabling offline engine fallback."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            full_prompt = f"{system_instruction}\n\n{prompt}"
            response = await model.generate_content_async(full_prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini API invocation failed: {e}")

    if openai_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_key)
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )
            if completion.choices and completion.choices[0].message.content:
                return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"OpenAI API invocation failed: {e}")

    return None
