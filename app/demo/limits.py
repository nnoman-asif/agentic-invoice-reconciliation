"""Redis-backed daily demo run limits (token + IP, stricter wins)."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis

from app.config import settings


def seconds_until_utc_midnight() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(1, int((tomorrow - now).total_seconds()))


def token_fingerprint(token_or_key: str) -> str:
    return hashlib.sha256(token_or_key.encode("utf-8")).hexdigest()[:32]


def _runs_key(kind: str, identity: str) -> str:
    return f"demo:runs:{kind}:{identity}"


def _used_key(token_fp: str) -> str:
    return f"demo:used:{token_fp}"


async def get_run_counts(
    redis: Redis, *, token_key: str, ip: str
) -> tuple[int, int]:
    token_fp = token_fingerprint(token_key)
    ip_fp = token_fingerprint(ip)
    pipe = redis.pipeline()
    pipe.get(_runs_key("tok", token_fp))
    pipe.get(_runs_key("ip", ip_fp))
    tok_raw, ip_raw = await pipe.execute()
    tok_count = int(tok_raw or 0)
    ip_count = int(ip_raw or 0)
    return tok_count, ip_count


async def remaining_runs(
    redis: Redis, *, token_key: str, ip: str
) -> int:
    tok_count, ip_count = await get_run_counts(redis, token_key=token_key, ip=ip)
    used = max(tok_count, ip_count)
    return max(0, settings.demo_runs_per_day - used)


async def get_used_scenarios(redis: Redis, *, token_key: str) -> set[str]:
    members = await redis.smembers(_used_key(token_fingerprint(token_key)))
    return set(members or [])


async def record_demo_run(
    redis: Redis,
    *,
    token_key: str,
    ip: str,
    scenario_id: str,
) -> int:
    """Increment token + IP counters and mark scenario used. Returns remaining."""
    ttl = seconds_until_utc_midnight()
    token_fp = token_fingerprint(token_key)
    ip_fp = token_fingerprint(ip)

    pipe = redis.pipeline()
    pipe.incr(_runs_key("tok", token_fp))
    pipe.expire(_runs_key("tok", token_fp), ttl)
    pipe.incr(_runs_key("ip", ip_fp))
    pipe.expire(_runs_key("ip", ip_fp), ttl)
    pipe.sadd(_used_key(token_fp), scenario_id)
    pipe.expire(_used_key(token_fp), ttl)
    results = await pipe.execute()
    tok_count = int(results[0])
    ip_count = int(results[2])
    used = max(tok_count, ip_count)
    return max(0, settings.demo_runs_per_day - used)
