"""FastAPI dependencies for identity and ownership."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.firebase import verify_id_token
from app.auth.guest import verify_guest_token
from app.config import LOCAL_DEV_USER_ID, SYSTEM_USER_ID, settings
from app.db.session import get_db
from app.models.database import User

_LAST_SEEN_THROTTLE = timedelta(hours=1)


@dataclass(frozen=True)
class OwnerContext:
    """Resolved caller identity for multi-tenant scoping."""

    user_id: uuid.UUID
    kind: str
    daily_invoice_limit: int
    max_upload_mb: int
    max_pdf_pages: int
    email: str | None = None
    display_name: str | None = None
    last_seen_at: datetime | None = None
    created_at: datetime | None = None


def require_owned_write(
    row: Any,
    owner_id: uuid.UUID,
    *,
    not_found: str = "Not found",
) -> None:
    """Guard mutating routes: 404 if missing/foreign, 403 if system-owned."""
    if row is None:
        raise HTTPException(status_code=404, detail=not_found)
    if row.owner_id == SYSTEM_USER_ID:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify system-owned data",
        )
    if row.owner_id != owner_id:
        raise HTTPException(status_code=404, detail=not_found)


def _owner_from_user(user: User) -> OwnerContext:
    return OwnerContext(
        user_id=user.id,
        kind=user.kind,
        daily_invoice_limit=user.daily_invoice_limit,
        max_upload_mb=user.max_upload_mb,
        max_pdf_pages=user.max_pdf_pages,
        email=user.email,
        display_name=user.display_name,
        last_seen_at=user.last_seen_at,
        created_at=user.created_at,
    )


async def _touch_last_seen(db: AsyncSession, user: User) -> None:
    """Bump last_seen_at at most once per hour."""
    now = datetime.now(timezone.utc)
    last = user.last_seen_at
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if last is not None and (now - last) < _LAST_SEEN_THROTTLE:
        return
    user.last_seen_at = now
    user.updated_at = now
    await db.flush()


async def _local_dev_owner(db: AsyncSession) -> OwnerContext:
    result = await db.execute(select(User).where(User.id == LOCAL_DEV_USER_ID))
    user = result.scalar_one_or_none()
    if user is not None:
        return _owner_from_user(user)
    return OwnerContext(
        user_id=LOCAL_DEV_USER_ID,
        kind="user",
        daily_invoice_limit=15,
        max_upload_mb=10,
        max_pdf_pages=10,
    )


async def _resolve_firebase_user(
    db: AsyncSession, bearer_token: str
) -> User:
    identity = verify_id_token(bearer_token)
    result = await db.execute(
        select(User).where(User.firebase_uid == identity.uid)
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            kind="user",
            firebase_uid=identity.uid,
            email=identity.email,
            display_name=identity.display_name,
            last_seen_at=now,
        )
        db.add(user)
        await db.flush()
    else:
        if identity.email and identity.email != user.email:
            user.email = identity.email
        if identity.display_name and identity.display_name != user.display_name:
            user.display_name = identity.display_name
        await _touch_last_seen(db, user)

    return user


async def _resolve_guest_user(db: AsyncSession, token: str) -> User:
    user_id = verify_guest_token(token)
    result = await db.execute(
        select(User).where(User.id == user_id, User.kind == "guest")
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Guest user not found")
    await _touch_last_seen(db, user)
    return user


async def get_current_owner(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OwnerContext:
    """Resolve the current owner.

    When ``auth_enabled`` is False, always return the bootstrapped
    local-dev user (local development).

    When auth is on: ``Authorization: Bearer <firebase-id-token>`` upserts
    a user row; ``X-Guest-Token`` resolves an existing guest; neither
    yields HTTP 401.
    """
    if not settings.auth_enabled:
        return await _local_dev_owner(db)

    auth_header = request.headers.get("Authorization") or ""
    guest_header = request.headers.get("X-Guest-Token")

    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing bearer token")
        try:
            user = await _resolve_firebase_user(db, token)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        return _owner_from_user(user)

    if guest_header:
        try:
            user = await _resolve_guest_user(db, guest_header.strip())
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        return _owner_from_user(user)

    raise HTTPException(
        status_code=401,
        detail="Authentication required (Bearer token or X-Guest-Token)",
    )
