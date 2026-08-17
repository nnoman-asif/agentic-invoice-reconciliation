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


CATEGORY_META = {
    "suggestion": {"title": "💡 User Suggestion / Feature Request", "color": 0xF59E0B},
    "bug": {"title": "🐛 User Bug Report", "color": 0xEF4444},
    "quota_increase": {"title": "📈 Quota Increase Request", "color": 0x2563EB},
    "general": {"title": "💬 General Feedback", "color": 0x8B5CF6},
}


async def notify_user_feedback(
    *,
    category: str,
    subject: str,
    message: str,
    user_id: uuid.UUID,
    user_kind: str,
    display_name: str | None,
    email: str | None,
    current_limit: int | None = None,
    requested_limit: int | None = None,
) -> bool:
    """POST a structured feedback embed to Discord. Returns True on success."""
    url = (settings.discord_webhook_url or "").strip()
    if not url:
        logger.warning("[Feedback] DISCORD_WEBHOOK_URL unset; feedback logged without notify")
        return False

    meta = CATEGORY_META.get(category, {"title": "💬 User Feedback", "color": 0x64748B})
    name = display_name or email or str(user_id)

    fields = [
        {"name": "User", "value": name, "inline": True},
        {"name": "Email", "value": email or "—", "inline": True},
        {"name": "Category", "value": category.replace("_", " ").title(), "inline": True},
        {"name": "Subject", "value": subject[:200], "inline": False},
        {"name": "User ID", "value": str(user_id), "inline": False},
    ]

    if requested_limit is not None and current_limit is not None:
        fields.append({
            "name": "Limit Change",
            "value": f"Current: **{current_limit}** → Requested: **{requested_limit}**",
            "inline": True,
        })

    fields.append({
        "name": "Details / Message",
        "value": message[:2000] if message else "—",
        "inline": False,
    })

    content = {
        "embeds": [
            {
                "title": meta["title"],
                "color": meta["color"],
                "fields": fields,
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=content)
            if resp.status_code >= 400:
                logger.error(
                    "[Feedback] Discord webhook failed: %s %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        return True
    except Exception as exc:
        logger.error("[Feedback] Discord webhook error: %s", exc)
        return False

