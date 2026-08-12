"""FastAPI dependencies for identity and ownership."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import LOCAL_DEV_USER_ID, settings
from app.db.session import get_db
from app.models.database import User


@dataclass(frozen=True)
class OwnerContext:
    """Resolved caller identity for multi-tenant scoping."""

    user_id: uuid.UUID
    kind: str
    daily_invoice_limit: int
    max_upload_mb: int
    max_pdf_pages: int


async def get_current_owner(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OwnerContext:
    """Resolve the current owner.

    While ``auth_enabled`` is False (local/default), always return the
    bootstrapped local-dev user. Commit 6 replaces this with Firebase /
    guest token verification behind the same signature.
    """
    del request  # used by Commit 6 for Authorization / X-Guest-Token

    if not settings.auth_enabled:
        result = await db.execute(select(User).where(User.id == LOCAL_DEV_USER_ID))
        user = result.scalar_one_or_none()
        if user is not None:
            return OwnerContext(
                user_id=user.id,
                kind=user.kind,
                daily_invoice_limit=user.daily_invoice_limit,
                max_upload_mb=user.max_upload_mb,
                max_pdf_pages=user.max_pdf_pages,
            )
        return OwnerContext(
            user_id=LOCAL_DEV_USER_ID,
            kind="user",
            daily_invoice_limit=15,
            max_upload_mb=10,
            max_pdf_pages=10,
        )

    # Placeholder until Commit 6 wires real auth. Keep the signature stable.
    raise NotImplementedError("auth_enabled=True requires Commit 6 Firebase/guest auth")
