"""Embedding generation using Ollama Qwen3-Embedding."""

import ollama

from app.config import settings


def get_embedding(text: str) -> list[float]:
    """Generate a 1024-dim embedding from text using Qwen3-Embedding via Ollama."""
    response = ollama.embed(
        model=settings.ollama_embedding_model,
        input=text,
    )
    return response["embeddings"][0]


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in a single call."""
    response = ollama.embed(
        model=settings.ollama_embedding_model,
        input=texts,
    )
    return response["embeddings"]
