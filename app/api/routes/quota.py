"""Quota API: caller usage + system healthy/limited (no raw global numbers)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.deps import OwnerContext, get_current_owner
from app.tools.quota import get_quota_snapshot

router = APIRouter(prefix="/quota", tags=["Quota"])


class QuotaResponse(BaseModel):
    used: int
    remaining: int
    limit: int
    reset_at: datetime
    system_status: str
    llm_paused: bool = False


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
