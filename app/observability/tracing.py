"""Langfuse v3 observability integration for tracing agent pipeline steps."""

import logging
import time
from contextlib import contextmanager
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_langfuse_client = None
_initialized = False


def get_langfuse():
    """Lazy-initialize Langfuse v3 client."""
    global _langfuse_client, _initialized
    if _initialized:
        return _langfuse_client

    _initialized = True

    if not settings.langfuse_enabled:
        logger.info("[Tracing] Langfuse is disabled (LANGFUSE_ENABLED=false)")
        return None

    try:
        from langfuse import Langfuse
        logger.info(f"[Tracing] Connecting to Langfuse at {settings.langfuse_host}")
        _langfuse_client = Langfuse(
            secret_key=settings.langfuse_secret_key,
            public_key=settings.langfuse_public_key,
            base_url=settings.langfuse_host,
        )
        if _langfuse_client.auth_check():
            logger.info("[Tracing] Langfuse client authenticated successfully")
        else:
            logger.error("[Tracing] Langfuse auth check failed -- check your API keys")
            _langfuse_client = None
        return _langfuse_client
    except Exception as e:
        logger.error(f"[Tracing] Failed to initialize Langfuse: {e}", exc_info=True)
        _langfuse_client = None
        return None


def create_trace(invoice_id: str, name: str = "invoice_reconciliation") -> Any | None:
    """Create a new Langfuse trace for an invoice processing run."""
    client = get_langfuse()
    if not client:
        return None

    try:
        observation = client.start_as_current_observation(
            as_type="span",
            name=name,
            metadata={"invoice_id": invoice_id, "type": "reconciliation"},
        )
        trace = observation.__enter__()
        logger.info(f"[Tracing] Created trace for invoice {invoice_id}")
        return trace
    except Exception as e:
        logger.error(f"[Tracing] Failed to create trace: {e}", exc_info=True)
        return None


def trace_agent_step(
    parent_trace: Any | None,
    agent_name: str,
    input_data: dict,
    output_data: dict,
    duration_ms: float,
) -> None:
    """Log an agent step as a child span."""
    client = get_langfuse()
    if not client or not parent_trace:
        return

    try:
        with client.start_as_current_observation(
            as_type="span",
            name=agent_name,
        ) as span:
            span.update(
                input=_sanitize(input_data),
                output=_sanitize(output_data),
                metadata={"duration_ms": round(duration_ms, 2)},
            )
        logger.debug(f"[Tracing] Logged span '{agent_name}' ({duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"[Tracing] Failed to log span {agent_name}: {e}", exc_info=True)


def end_trace(trace: Any | None) -> None:
    """End the current trace span."""
    if not trace:
        return
    try:
        trace.update(output="Pipeline completed")
        trace.__exit__(None, None, None)
    except Exception:
        pass


@contextmanager
def trace_span(parent: Any | None, name: str):
    """Context manager to automatically time and log a span."""
    client = get_langfuse()
    if not client or not parent:
        result = {"output": None, "error": None}
        yield result
        return

    try:
        with client.start_as_current_observation(as_type="span", name=name) as span:
            result = {"output": None, "error": None}
            try:
                yield result
            except Exception as e:
                result["error"] = str(e)
                raise
            finally:
                span.update(output=_sanitize(result))
    except Exception:
        result = {"output": None, "error": "span creation failed"}
        yield result


def flush():
    """Flush any pending Langfuse events."""
    client = get_langfuse()
    if client:
        try:
            client.flush()
        except Exception:
            pass


def _sanitize(data: Any, max_depth: int = 3) -> Any:
    """Sanitize data for Langfuse, removing non-serializable objects."""
    if max_depth <= 0:
        return str(data)

    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if k in ("db_session", "embedding"):
                sanitized[k] = f"<{type(v).__name__}>"
            else:
                sanitized[k] = _sanitize(v, max_depth - 1)
        return sanitized
    elif isinstance(data, (list, tuple)):
        return [_sanitize(item, max_depth - 1) for item in data[:20]]
    elif isinstance(data, (str, int, float, bool, type(None))):
        return data
    else:
        return str(data)
