"""Auth routes: guest minting, identity, and account deletion."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete as sql_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.auth.guest import mint_guest_token
from app.config import SYSTEM_USER_ID, settings
from app.db.session import get_db
from app.models.database import Invoice, User
from app.models.schemas import AuthMeResponse, GuestAuthResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _scheduled_deletion(user: User | OwnerContext) -> datetime | None:
    """When cleanup will remove this account (best-effort estimate)."""
    kind = user.kind
    if kind == "system":
        return None

    if kind == "guest":
        created = getattr(user, "created_at", None) or datetime.now(timezone.utc)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created + timedelta(hours=24)

    last_seen = getattr(user, "last_seen_at", None) or datetime.now(timezone.utc)
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return last_seen + timedelta(days=settings.inactive_account_days)


def _me_response(owner: OwnerContext) -> AuthMeResponse:
    return AuthMeResponse(
        id=owner.user_id,
        kind=owner.kind,
        email=owner.email,
        display_name=owner.display_name,
        daily_invoice_limit=owner.daily_invoice_limit,
        max_upload_mb=owner.max_upload_mb,
        max_pdf_pages=owner.max_pdf_pages,
        last_seen_at=owner.last_seen_at,
        created_at=owner.created_at,
        scheduled_deletion_at=_scheduled_deletion(owner),
    )


@router.post("/guest", response_model=GuestAuthResponse, status_code=201)
async def create_guest(db: AsyncSession = Depends(get_db)):
    """Mint a guest user and return a signed X-Guest-Token value."""
    now = datetime.now(timezone.utc)
    user = User(
        kind="guest",
        display_name="Guest",
        daily_invoice_limit=3,
        max_upload_mb=5,
        max_pdf_pages=10,
        last_seen_at=now,
    )
    db.add(user)
    await db.flush()

    token = mint_guest_token(user.id)
    return GuestAuthResponse(
        guest_token=token,
        user=AuthMeResponse(
            id=user.id,
            kind=user.kind,
            email=user.email,
            display_name=user.display_name,
            daily_invoice_limit=user.daily_invoice_limit,
            max_upload_mb=user.max_upload_mb,
            max_pdf_pages=user.max_pdf_pages,
            last_seen_at=user.last_seen_at,
            created_at=user.created_at,
            scheduled_deletion_at=_scheduled_deletion(user),
        ),
    )


@router.get("/me", response_model=AuthMeResponse)
async def get_me(owner: OwnerContext = Depends(get_current_owner)):
    return _me_response(owner)


@router.delete("/me", status_code=204)
async def delete_me(
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Delete the caller's account, cascaded rows, and uploaded files."""
    if owner.user_id == SYSTEM_USER_ID or owner.kind == "system":
        raise HTTPException(
            status_code=403,
            detail="Cannot delete the system account",
        )

    result = await db.execute(select(User).where(User.id == owner.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    paths_q = await db.execute(
        select(Invoice.raw_file_path).where(Invoice.owner_id == owner.user_id)
    )
    file_paths = [p for p in paths_q.scalars().all() if p]

    await db.execute(sql_delete(User).where(User.id == owner.user_id))
    await db.flush()

    for raw in file_paths:
        try:
            path = Path(raw)
            if path.is_file():
                path.unlink()
        except OSError as exc:
            logger.warning(
                "[Auth] Failed to delete upload %s for user %s: %s",
                raw,
                owner.user_id,
                exc,
            )

    return None
