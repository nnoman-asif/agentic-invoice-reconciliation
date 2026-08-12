"""Canonical embedding access for the matcher.

All embedding calls go through this module so a provider swap
(Ollama <-> Gemini) is a one-file change. The
`po_line_items.description_embedding` column is an unconstrained
`vector` so local (1024) and remote (1536) dimensions can coexist;
stamp `embedding_model` / `embedding_dim` on write and treat a
mismatch as a cache miss.
"""

from __future__ import annotations

import logging

import numpy as np
import ollama

from app.config import settings

logger = logging.getLogger(__name__)


def active_embedding_model() -> str:
    return settings.resolved_embedding_model


def active_embedding_dim() -> int:
    return settings.resolved_embedding_dim


def embedding_cache_usable(
    model: str | None,
    dim: int | None,
    vector: object | None,
) -> bool:
    """True when a stored vector was produced by the active provider."""
    if vector is None:
        return False
    return model == active_embedding_model() and dim == active_embedding_dim()


def get_embedding(text: str) -> list[float]:
    """Generate an embedding for a single text."""
    return get_embeddings_batch([text])[0]


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in a single provider call."""
    if not texts:
        return []
    provider = (settings.llm_provider or "ollama").strip().lower()
    logger.info(
        "[Embeddings] batch embedding %d text(s) via %s/%s",
        len(texts),
        provider,
        active_embedding_model(),
    )
    if provider == "gemini":
        return _gemini_embeddings_batch(texts)
    if provider != "ollama":
        raise RuntimeError(f"Unsupported llm_provider: {settings.llm_provider!r}")
    response = ollama.embed(
        model=active_embedding_model(),
        input=texts,
    )
    return response["embeddings"]


def _gemini_embeddings_batch(texts: list[str]) -> list[list[float]]:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "llm_provider=gemini but GEMINI_API_KEY is not set"
        )
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    dim = active_embedding_dim()
    model = active_embedding_model()
    # google-genai accepts one content per call in some versions; batch
    # when the SDK supports it, otherwise loop.
    out: list[list[float]] = []
    for text in texts:
        result = client.models.embed_content(
            model=model,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=dim),
        )
        embedding = result.embeddings[0].values
        out.append(list(embedding))
    return out


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Cosine similarity between every row of `a` and every row of `b`.

    Returns shape (len(a), len(b)). Zero-norm rows score 0.

    Explicit L2 normalisation must stay: gemini-embedding-001 (and the
    truncated gemini-embedding-2 output at output_dimensionality=1536)
    does not guarantee unit-norm vectors. Removing this would silently
    break matching scores when comparing Gemini vectors.
    """
    a_norm = np.linalg.norm(a, axis=1, keepdims=True)
    b_norm = np.linalg.norm(b, axis=1, keepdims=True)
    a_norm[a_norm == 0] = 1.0
    b_norm[b_norm == 0] = 1.0
    return (a / a_norm) @ (b / b_norm).T
