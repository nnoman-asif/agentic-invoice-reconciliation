"""Single choke point for every chat-model call.

Rate limiting (Commit 12) and quota counting (Commit 13) wrap this
module so every provider invoke is accounted for in one place.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_ollama import ChatOllama

from app.config import settings

logger = logging.getLogger(__name__)


def get_chat_model(*, json_mode: bool = True) -> BaseChatModel:
    """Return a chat model for the configured provider.

    Ollama uses ``format="json"``. Gemini uses the chat model's
    ``response_mime_type="application/json"`` field — do **not** pass
    this via ``model_kwargs`` (not reliably plumbed through
    langchain-google-genai). Callers must ``json.loads`` the response
    content; never fall back to regex fence-stripping.
    """
    provider = (settings.llm_provider or "ollama").strip().lower()
    model_name = settings.resolved_chat_model

    if provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError(
                "llm_provider=gemini but GEMINI_API_KEY is not set"
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs: dict[str, Any] = {
            "model": model_name,
            "google_api_key": settings.gemini_api_key,
            "temperature": 0,
        }
        if json_mode:
            # Direct field on ChatGoogleGenerativeAI — not model_kwargs,
            # which is not reliably plumbed through langchain-google-genai.
            kwargs["response_mime_type"] = "application/json"
        logger.debug("[LLM] ChatGoogleGenerativeAI model=%s json=%s", model_name, json_mode)
        return ChatGoogleGenerativeAI(**kwargs)

    if provider != "ollama":
        raise RuntimeError(f"Unsupported llm_provider: {settings.llm_provider!r}")

    logger.debug("[LLM] ChatOllama model=%s json=%s", model_name, json_mode)
    return ChatOllama(
        model=model_name,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json" if json_mode else None,
    )
