"""Redis-backed rate limits, in-flight caps, and queue position.

Upload / demo / webhook paths call the async helpers. Chat calls go
through ``wait_for_provider_slot`` inside ``get_chat_model`` so the
global 20 RPM ceiling backs off instead of failing the job.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import redis as sync_redis
from fastapi import HTTPException
from redis.asyncio import Redis

from app.config import settings

logger = logging.getLogger(__name__)

QUEUE_NAME = "invoice_queue"

# Lua: allow re-acquire if already a member; otherwise SCARD-check + SADD.
_ACQUIRE_INFLIGHT_LUA = """
if redis.call('SISMEMBER', KEYS[1], ARGV[2]) == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  return 1
end
local n = redis.call('SCARD', KEYS[1])
if n >= tonumber(ARGV[1]) then
  return 0
end
redis.call('SADD', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 1
"""

_sync_client: sync_redis.Redis | None = None


def _minute_bucket(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y%m%d%H%M")


def _upload_key(owner_id: uuid.UUID) -> str:
    return f"limit:upload:{owner_id}:{_minute_bucket()}"


def _inflight_key(owner_id: uuid.UUID) -> str:
    return f"limit:inflight:{owner_id}"


def _provider_rpm_key() -> str:
    return f"limit:provider:rpm:{_minute_bucket()}"


def _provider_throttled_key() -> str:
    return "limit:provider:throttled"


def _get_sync_redis() -> sync_redis.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = sync_redis.from_url(
            settings.redis_url, decode_responses=True
        )
    return _sync_client


# ── Upload rate (async) ─────────────────────────────────────────────


async def check_upload_rate(redis: Redis, owner_id: uuid.UUID) -> None:
    """Raise 429 if this owner has hit uploads-per-minute."""
    limit = settings.upload_rate_per_minute
    key = _upload_key(owner_id)
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > limit:
        ttl = await redis.ttl(key)
        retry_after = max(1, int(ttl) if ttl and ttl > 0 else 60)
        raise HTTPException(
            status_code=429,
            detail=(
                f"Upload rate limit exceeded ({limit} per minute). "
                f"Retry in {retry_after}s."
            ),
            headers={"Retry-After": str(retry_after)},
        )


# ── In-flight cap (async) ───────────────────────────────────────────


async def acquire_inflight(
    redis: Redis,
    owner_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> None:
    """Reserve an in-flight slot; raise 429 if the user is at the cap."""
    cap = settings.max_inflight_per_user
    ok = await redis.eval(
        _ACQUIRE_INFLIGHT_LUA,
        1,
        _inflight_key(owner_id),
        str(cap),
        str(invoice_id),
        str(settings.inflight_ttl_seconds),
    )
    if not ok:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You already have {cap} invoice(s) processing. "
                "Wait for it to finish before uploading another."
            ),
            headers={"Retry-After": "30"},
        )


async def release_inflight(
    redis: Redis,
    owner_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> None:
    await redis.srem(_inflight_key(owner_id), str(invoice_id))


async def release_inflight_by_ids(
    owner_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> None:
    """Release using a short-lived Redis client (worker / service path)."""
    client = sync_redis.from_url(settings.redis_url, decode_responses=True)
    try:
        client.srem(_inflight_key(owner_id), str(invoice_id))
    finally:
        client.close()


# ── Queue position (async) ──────────────────────────────────────────


async def get_queue_position(redis: Redis, invoice_id: str | uuid.UUID) -> int | None:
    """1-based position accounting for LPUSH producer + BRPOP consumer.

    The list head (index 0) is the newest job; BRPOP takes from the
    tail, so position = LLEN - LPOS.
    """
    inv = str(invoice_id)
    index = await redis.lpos(QUEUE_NAME, inv)
    if index is None:
        return None
    length = await redis.llen(QUEUE_NAME)
    return max(1, int(length) - int(index))


async def is_provider_throttled(redis: Redis) -> bool:
    return bool(await redis.exists(_provider_throttled_key()))


async def enqueue_invoice(
    redis: Redis,
    owner_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> int | None:
    """LPUSH onto the shared queue; return queue position (1-based)."""
    await redis.lpush(QUEUE_NAME, str(invoice_id))
    return await get_queue_position(redis, invoice_id)


# ── Global provider RPM (sync; used from chat invoke) ───────────────


def wait_for_provider_slot() -> None:
    """Block until under the global provider RPM ceiling.

    Sets a short-lived throttled flag so the API can tell waiting users
    that high traffic (not a hang) is why their job is paused.
    """
    limit = settings.provider_rpm_limit
    r = _get_sync_redis()
    backoff = 0.5
    while True:
        key = _provider_rpm_key()
        count = r.incr(key)
        if count == 1:
            r.expire(key, 60)
        if count <= limit:
            r.delete(_provider_throttled_key())
            return
        # Undo the over-limit incr so the window isn't permanently inflated.
        r.decr(key)
        r.set(_provider_throttled_key(), "1", ex=30)
        ttl = r.ttl(key)
        sleep_for = max(backoff, float(ttl) if ttl and ttl > 0 else 1.0)
        logger.info(
            "[Limits] Provider RPM ceiling (%s/min) hit; backing off %.1fs",
            limit,
            sleep_for,
        )
        time.sleep(min(sleep_for, 15.0))
        backoff = min(backoff * 1.5, 8.0)


def invoke_with_provider_retry(invoke_fn, *args: Any, **kwargs: Any) -> Any:
    """Call ``invoke_fn`` after acquiring a slot; retry on provider 429s."""
    max_attempts = settings.provider_retry_max
    delay = 1.0
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        wait_for_provider_slot()
        try:
            return invoke_fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            if not _is_rate_limit_error(exc) or attempt >= max_attempts:
                raise
            logger.warning(
                "[Limits] Provider 429 (attempt %s/%s); retry in %.1fs: %s",
                attempt,
                max_attempts,
                delay,
                exc,
            )
            _get_sync_redis().set(_provider_throttled_key(), "1", ex=60)
            time.sleep(delay)
            delay = min(delay * 2, 30.0)
    assert last_exc is not None
    raise last_exc


def _is_rate_limit_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    if "429" in text or "rate limit" in text or "resource_exhausted" in text:
        return True
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    return status == 429
