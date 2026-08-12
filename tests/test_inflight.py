"""In-flight slot release must be synchronous so the worker actually frees it."""

from __future__ import annotations

import inspect
import uuid

import redis as sync_redis

from app.config import settings
from app.services.invoice_service import _release_inflight_slot
from app.tools.limits import _inflight_key, release_inflight_by_ids


def test_release_inflight_by_ids_is_not_async():
    """Guard against re-adding `async` — the worker never awaits this."""
    assert inspect.iscoroutinefunction(release_inflight_by_ids) is False


def test_release_inflight_by_ids_empties_redis_set():
    owner_id = uuid.uuid4()
    invoice_id = uuid.uuid4()
    key = _inflight_key(owner_id)
    client = sync_redis.from_url(settings.redis_url, decode_responses=True)
    try:
        client.sadd(key, str(invoice_id))
        client.expire(key, 60)
        assert str(invoice_id) in client.smembers(key)

        release_inflight_by_ids(owner_id, invoice_id)

        assert client.smembers(key) == set()
    finally:
        client.delete(key)
        client.close()


def test_release_inflight_slot_empties_redis_set():
    """The invoice-service wrapper must actually SREM, not discard a coroutine."""
    owner_id = uuid.uuid4()
    invoice_id = uuid.uuid4()
    key = _inflight_key(owner_id)
    client = sync_redis.from_url(settings.redis_url, decode_responses=True)
    try:
        client.sadd(key, str(invoice_id))
        client.expire(key, 60)

        _release_inflight_slot(owner_id, invoice_id)

        assert client.smembers(key) == set()
    finally:
        client.delete(key)
        client.close()
