"""Quota API: usage snapshot + increase-request endpoint."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.db.session import get_db
from app.models.database import QuotaRequest, User
from app.tools.discord import notify_quota_request
from app.tools.quota import get_quota_snapshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quota", tags=["Quota"])


class QuotaResponse(BaseModel):
    used: int
    remaining: int
    limit: int
    reset_at: datetime
    system_status: str
    llm_paused: bool = False


class QuotaRequestCreate(BaseModel):
    requested_limit: int = Field(..., ge=1, le=10_000)
    reason: str | None = Field(None, max_length=2000)


class QuotaRequestResponse(BaseModel):
    id: uuid.UUID
    requested_limit: int
    reason: str | None
    status: str
    created_at: datetime
    discord_notified: bool = False

    model_config = {"from_attributes": True}


@router.get("", response_model=QuotaResponse)
async def get_quota(
    request: Request,
    owner: OwnerContext = Depends(get_current_owner),
):
    snap = await get_quota_snapshot(
        request.app.state.redis,
        owner_id=owner.user_id,
        daily_limit=owner.daily_invoice_limit,
    )
    return QuotaResponse(
        used=snap.used,
        remaining=snap.remaining,
        limit=snap.limit,
        reset_at=snap.reset_at,
        system_status=snap.system_status,
        llm_paused=snap.llm_paused,
    )


@router.post("/request", response_model=QuotaRequestResponse, status_code=201)
async def create_quota_request(
    body: QuotaRequestCreate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Persist a quota increase request, then best-effort Discord notify.

    The row is written and committed first so a webhook failure never
    loses the request.
    """
    if body.requested_limit <= owner.daily_invoice_limit:
        raise HTTPException(
            status_code=400,
            detail=(
                f"requested_limit must be greater than your current limit "
                f"({owner.daily_invoice_limit})"
            ),
        )

    pending = await db.execute(
        select(QuotaRequest.id).where(
            QuotaRequest.user_id == owner.user_id,
            QuotaRequest.status == "pending",
        )
    )
    if pending.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending quota request",
        )

    row = QuotaRequest(
        user_id=owner.user_id,
        requested_limit=body.requested_limit,
        reason=(body.reason or "").strip() or None,
        status="pending",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    user = await db.get(User, owner.user_id)
    notified = await notify_quota_request(
        request_id=row.id,
        user_id=owner.user_id,
        user_kind=owner.kind,
        display_name=owner.display_name or (user.display_name if user else None),
        email=owner.email or (user.email if user else None),
        current_limit=owner.daily_invoice_limit,
        requested_limit=row.requested_limit,
        reason=row.reason,
    )
    if not notified:
        logger.info(
            "[Quota] Request %s saved; Discord notify skipped or failed",
            row.id,
        )

    return QuotaRequestResponse(
        id=row.id,
        requested_limit=row.requested_limit,
        reason=row.reason,
        status=row.status,
        created_at=row.created_at,
        discord_notified=notified,
    )
