"""Daily invoice quota, global chat cap, kill switch, and degraded mode.

Quota is charged at the provider call inside ``llm.py`` (not at upload),
so gate-rejected PDFs cost nothing. Per-user counters track invoices that
hit the LLM; the global counter tracks every chat invoke.
"""

from __future__ import annotations

import logging
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterator

import redis as sync_redis
from fastapi import HTTPException
from redis.asyncio import Redis

from app.config import settings
from app.demo.limits import seconds_until_utc_midnight

logger = logging.getLogger(__name__)

LLM_PAUSED_KEY = "system:llm_paused"
GLOBAL_CHAT_KEY_PREFIX = "quota:global:chat:"
USER_INVOICE_KEY_PREFIX = "quota:user:invoices:"
INVOICE_COUNTED_PREFIX = "quota:invoice:counted:"

_owner_id: ContextVar[uuid.UUID | None] = ContextVar("quota_owner_id", default=None)
_invoice_id: ContextVar[uuid.UUID | None] = ContextVar("quota_invoice_id", default=None)
_daily_limit: ContextVar[int | None] = ContextVar("quota_daily_limit", default=None)

_sync_client: sync_redis.Redis | None = None


class QuotaExceeded(RuntimeError):
    """Raised when a provider call cannot proceed due to quota/kill switch."""


@dataclass(frozen=True)
class QuotaSnapshot:
    used: int
    remaining: int
    limit: int
    reset_at: datetime
    system_status: str  # "healthy" | "limited"
    llm_paused: bool


def _day_stamp(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y%m%d")


def _utc_midnight_reset() -> datetime:
    now = datetime.now(timezone.utc)
    return (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _get_sync_redis() -> sync_redis.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = sync_redis.from_url(
            settings.redis_url, decode_responses=True
        )
    return _sync_client


def _user_key(owner_id: uuid.UUID) -> str:
    return f"{USER_INVOICE_KEY_PREFIX}{owner_id}:{_day_stamp()}"


def _global_key() -> str:
    return f"{GLOBAL_CHAT_KEY_PREFIX}{_day_stamp()}"


def _counted_key(invoice_id: uuid.UUID) -> str:
    return f"{INVOICE_COUNTED_PREFIX}{invoice_id}"


@contextmanager
def quota_context(
    *,
    owner_id: uuid.UUID,
    invoice_id: uuid.UUID,
    daily_limit: int,
) -> Iterator[None]:
    """Bind owner/invoice for chat invokes on this pipeline run."""
    t_owner = _owner_id.set(owner_id)
    t_inv = _invoice_id.set(invoice_id)
    t_lim = _daily_limit.set(max(1, int(daily_limit)))
    try:
        yield
    finally:
        _owner_id.reset(t_owner)
        _invoice_id.reset(t_inv)
        _daily_limit.reset(t_lim)


# ── Sync path (llm.py / worker) ─────────────────────────────────────


def is_llm_paused_sync() -> bool:
    return bool(_get_sync_redis().exists(LLM_PAUSED_KEY))


def is_global_limited_sync() -> bool:
    raw = _get_sync_redis().get(_global_key())
    used = int(raw or 0)
    return used >= settings.global_chat_daily_cap


def assert_provider_allowed() -> None:
    """Raise QuotaExceeded if kill switch or global cap blocks the call."""
    if is_llm_paused_sync():
        raise QuotaExceeded(
            "LLM processing is temporarily paused by the operator"
        )
    if is_global_limited_sync():
        raise QuotaExceeded(
            "System is at daily capacity; try again after UTC midnight"
        )


def record_provider_call() -> None:
    """Charge global chat + (once) per-user invoice quota for this invoke.

    Call after ``assert_provider_allowed`` and before the actual provider
    request. Retries that re-enter invoke will re-check the global cap;
    the per-invoice user charge is idempotent via SETNX.
    """
    assert_provider_allowed()
    r = _get_sync_redis()
    ttl = seconds_until_utc_midnight()

    # Global chat counter — every invoke counts.
    gkey = _global_key()
    gcount = r.incr(gkey)
    if gcount == 1:
        r.expire(gkey, ttl)
    if gcount > settings.global_chat_daily_cap:
        # Undo and refuse so we never silently run past the cap.
        r.decr(gkey)
        raise QuotaExceeded(
            "System is at daily capacity; try again after UTC midnight"
        )

    owner = _owner_id.get()
    invoice = _invoice_id.get()
    limit = _daily_limit.get() or settings.daily_invoice_limit_default
    if owner is None or invoice is None:
        return

    counted_key = _counted_key(invoice)
    # First successful claim for this invoice today → charge user quota.
    if r.set(counted_key, "1", nx=True, ex=ttl):
        ukey = _user_key(owner)
        ucount = r.incr(ukey)
        if ucount == 1:
            r.expire(ukey, ttl)
        if ucount > limit:
            r.decr(ukey)
            r.delete(counted_key)
            # Also roll back the global incr for this rejected call.
            r.decr(gkey)
            raise QuotaExceeded(
                f"Daily invoice limit reached ({limit}). Resets at UTC midnight."
            )


# ── Async path (API) ────────────────────────────────────────────────


async def is_llm_paused(redis: Redis) -> bool:
    return bool(await redis.exists(LLM_PAUSED_KEY))


async def is_system_limited(redis: Redis) -> bool:
    """True when global chat cap is hit (degraded mode for uploads/demo)."""
    raw = await redis.get(_global_key())
    used = int(raw or 0)
    return used >= settings.global_chat_daily_cap


async def assert_accepting_work(redis: Redis) -> None:
    """503 uploads/demo when degraded or kill-switched."""
    if await is_llm_paused(redis):
        raise HTTPException(
            status_code=503,
            detail=(
                "Invoice processing is temporarily paused. "
                "You can still browse existing data."
            ),
        )
    if await is_system_limited(redis):
        raise HTTPException(
            status_code=503,
            detail=(
                "System is at daily capacity. "
                "Browsing stays available; new uploads resume after UTC midnight."
            ),
        )


async def get_system_quota_status(redis: Redis) -> tuple[str, bool]:
    """Return ``(healthy|limited, llm_paused)`` without a user context."""
    paused = bool(await redis.exists(LLM_PAUSED_KEY))
    raw = await redis.get(_global_key())
    used = int(raw or 0)
    limited = paused or used >= settings.global_chat_daily_cap
    return ("limited" if limited else "healthy"), paused


async def get_quota_snapshot(
    redis: Redis,
    *,
    owner_id: uuid.UUID,
    daily_limit: int,
) -> QuotaSnapshot:
    limit = max(1, int(daily_limit))
    pipe = redis.pipeline()
    pipe.get(_user_key(owner_id))
    pipe.get(_global_key())
    pipe.exists(LLM_PAUSED_KEY)
    used_raw, global_raw, paused = await pipe.execute()
    used = int(used_raw or 0)
    global_used = int(global_raw or 0)
    limited = bool(paused) or global_used >= settings.global_chat_daily_cap
    return QuotaSnapshot(
        used=used,
        remaining=max(0, limit - used),
        limit=limit,
        reset_at=_utc_midnight_reset(),
        system_status="limited" if limited else "healthy",
        llm_paused=bool(paused),
    )
