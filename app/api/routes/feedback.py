"""Feedback API: user suggestions, bug reports, general feedback, and quota requests."""

from __future__ import annotations

import logging
from typing import Literal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.db.session import get_db
from app.models.database import QuotaRequest
from app.tools.discord import notify_user_feedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["Feedback"])

FeedbackCategory = Literal["suggestion", "bug", "quota_increase", "general"]


class FeedbackCreate(BaseModel):
    category: FeedbackCategory = Field(
        default="suggestion",
        description="Category of the feedback or request",
    )
    subject: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Brief subject or title",
    )
    message: str = Field(
        ...,
        min_length=5,
        max_length=3000,
        description="Detailed description or reasoning",
    )
    requested_limit: int | None = Field(
        None,
        ge=1,
        le=10_000,
        description="Requested daily limit (only relevant for quota_increase)",
    )


class FeedbackResponse(BaseModel):
    status: str
    category: str
    message: str
    created_at: datetime
    discord_notified: bool = False


@router.post("", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
):
    """Submit feedback, feature suggestion, bug report, or quota increase request.

    Only available to registered users (guests are blocked with 403).
    """
    if owner.kind == "guest":
        raise HTTPException(
            status_code=403,
            detail="Feedback and quota requests are only available for registered accounts. Please sign in.",
        )

    # If it is a quota increase request, validate and persist to quota_requests table
    if body.category == "quota_increase":
        if body.requested_limit is None or body.requested_limit <= owner.daily_invoice_limit:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"requested_limit must be greater than your current limit "
                    f"({owner.daily_invoice_limit})"
                ),
            )

        # Check for existing pending request
        pending = await db.execute(
            select(QuotaRequest.id).where(
                QuotaRequest.user_id == owner.user_id,
                QuotaRequest.status == "pending",
            )
        )
        if pending.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail="You already have a pending quota increase request under review.",
            )

        # Create durable DB row
        quota_req = QuotaRequest(
            user_id=owner.user_id,
            requested_limit=body.requested_limit,
            reason=f"[{body.subject}] {body.message}",
            status="pending",
        )
        db.add(quota_req)
        await db.commit()

    # Dispatch Discord notification
    notified = await notify_user_feedback(
        category=body.category,
        subject=body.subject,
        message=body.message,
        user_id=owner.user_id,
        user_kind=owner.kind,
        display_name=owner.display_name,
        email=owner.email,
        current_limit=owner.daily_invoice_limit,
        requested_limit=body.requested_limit,
    )

    return FeedbackResponse(
        status="received",
        category=body.category,
        message="Thank you! Your feedback has been received by our team.",
        created_at=datetime.utcnow(),
        discord_notified=notified,
    )
