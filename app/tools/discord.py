"""Notify Discord after a durable quota_requests row is written."""

from __future__ import annotations

import logging
import uuid

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def notify_quota_request(
    *,
    request_id: uuid.UUID,
    user_id: uuid.UUID,
    user_kind: str,
    display_name: str | None,
    email: str | None,
    current_limit: int,
    requested_limit: int,
    reason: str | None,
) -> bool:
    """POST an embed to Discord. Returns True on success.

    Failures are logged but never raised — the DB row is the source of
    truth and must survive a webhook outage.
    """
    url = (settings.discord_webhook_url or "").strip()
    if not url:
        logger.warning(
            "[Quota] DISCORD_WEBHOOK_URL unset; request %s saved without notify",
            request_id,
        )
        return False

    name = display_name or email or str(user_id)
    content = {
        "embeds": [
            {
                "title": "Quota increase request",
                "color": 0x2563EB,
                "fields": [
                    {"name": "Request ID", "value": str(request_id), "inline": False},
                    {"name": "User", "value": name, "inline": True},
                    {"name": "Kind", "value": user_kind, "inline": True},
                    {"name": "User ID", "value": str(user_id), "inline": False},
                    {
                        "name": "Current → Requested",
                        "value": f"{current_limit} → {requested_limit}",
                        "inline": True,
                    },
                    {
                        "name": "Reason",
                        "value": (reason or "—")[:1000],
                        "inline": False,
                    },
                ],
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=content)
            if resp.status_code >= 400:
                logger.error(
                    "[Quota] Discord webhook failed for %s: %s %s",
                    request_id,
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        return True
    except Exception as exc:
        logger.error("[Quota] Discord webhook error for %s: %s", request_id, exc)
        return False
