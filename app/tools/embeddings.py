"""Canonical embedding access for the matcher.

All embedding calls go through this module so a future provider swap
(Ollama -> Gemini / Groq / etc.) is a one-file change. The
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


def get_embedding(text: str) -> list[float]:
    """Generate a 1024-dim embedding from a single text."""
    response = ollama.embed(
        model=settings.ollama_embedding_model,
        input=text,
    )
    return response["embeddings"][0]


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in a single provider call."""
    if not texts:
        return []
    logger.info("[Embeddings] batch embedding %d text(s)", len(texts))
    response = ollama.embed(
        model=settings.ollama_embedding_model,
        input=texts,
    )
    return response["embeddings"]


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
    Returns shape (len(a), len(b)). Zero-norm rows score 0."""
    a_norm = np.linalg.norm(a, axis=1, keepdims=True)
    b_norm = np.linalg.norm(b, axis=1, keepdims=True)
    a_norm[a_norm == 0] = 1.0
    b_norm[b_norm == 0] = 1.0
    return (a / a_norm) @ (b / b_norm).T
