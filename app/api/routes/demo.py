"""Demo API: list scenarios and run a sample invoice server-side."""

from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.guest import mint_guest_token, verify_guest_token
from app.config import LOCAL_DEV_USER_ID, settings
from app.db.session import get_db
from app.demo.limits import get_used_scenarios, record_demo_run, remaining_runs
from app.demo.scenarios import get_scenario, list_scenarios
from app.models.database import Invoice, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["Demo"])


class DemoScenarioOut(BaseModel):
    id: str
    title: str
    description: str
    po_number: str
    expected_outcome: str
    used: bool


class DemoScenariosResponse(BaseModel):
    scenarios: list[DemoScenarioOut]
    remaining_today: int
    limit_per_day: int


class DemoRunRequest(BaseModel):
    scenario: str = Field(..., min_length=1)


class DemoRunResponse(BaseModel):
    invoice_id: uuid.UUID
    scenario: str
    guest_token: str | None = None
    remaining_today: int


def _client_ip(request: Request) -> str:
    if settings.trust_proxy_header:
        cf = (request.headers.get("CF-Connecting-IP") or "").strip()
        if cf:
            return cf
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def _resolve_demo_identity(
    request: Request,
    db: AsyncSession,
    *,
    mint_if_missing: bool,
) -> tuple[uuid.UUID, str, str | None]:
    """Return (owner_id, limit_token_key, new_guest_token_or_none)."""
    if not settings.auth_enabled:
        return LOCAL_DEV_USER_ID, "local-dev", None

    header = (request.headers.get("X-Guest-Token") or "").strip()
    if header:
        try:
            user_id = verify_guest_token(header)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        result = await db.execute(
            select(User).where(User.id == user_id, User.kind == "guest")
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=401, detail="Guest user not found")
        return user.id, header, None

    if not mint_if_missing:
        # Anonymous visitor — IP-only limit key; no owner yet.
        return LOCAL_DEV_USER_ID, f"anon:{_client_ip(request)}", None

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
    return user.id, token, token


@router.get("/scenarios", response_model=DemoScenariosResponse)
async def get_demo_scenarios(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    redis = request.app.state.redis
    ip = _client_ip(request)
    _, token_key, _ = await _resolve_demo_identity(
        request, db, mint_if_missing=False
    )

    remaining = await remaining_runs(redis, token_key=token_key, ip=ip)
    used = await get_used_scenarios(redis, token_key=token_key)

    scenarios = [
        DemoScenarioOut(
            id=s.id,
            title=s.title,
            description=s.description,
            po_number=s.po_number,
            expected_outcome=s.expected_outcome,
            used=s.id in used,
        )
        for s in list_scenarios()
    ]
    return DemoScenariosResponse(
        scenarios=scenarios,
        remaining_today=remaining,
        limit_per_day=settings.demo_runs_per_day,
    )


@router.post("/run", response_model=DemoRunResponse, status_code=201)
async def run_demo_scenario(
    body: DemoRunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    scenario = get_scenario(body.scenario)
    if scenario is None:
        raise HTTPException(status_code=400, detail=f"Unknown scenario {body.scenario!r}")

    if not scenario.pdf_path.is_file():
        logger.error("[Demo] Missing sample PDF at %s", scenario.pdf_path)
        raise HTTPException(
            status_code=500,
            detail="Sample invoice file is missing on the server",
        )

    redis = request.app.state.redis
    ip = _client_ip(request)
    owner_id, token_key, new_token = await _resolve_demo_identity(
        request, db, mint_if_missing=True
    )

    remaining = await remaining_runs(redis, token_key=token_key, ip=ip)
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Demo limit reached ({settings.demo_runs_per_day} per day). "
                "Sign in to keep going."
            ),
            headers={"Retry-After": "3600"},
        )

    invoice_id = uuid.uuid4()
    dest = Path(settings.upload_dir) / f"{invoice_id}.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(scenario.pdf_path, dest)

    invoice = Invoice(
        id=invoice_id,
        owner_id=owner_id,
        processing_status="queued",
        business_status="pending",
        raw_file_path=str(dest),
        file_content_type="application/pdf",
        po_reference=scenario.po_number,
    )
    db.add(invoice)
    await db.commit()

    try:
        await redis.lpush("invoice_queue", str(invoice_id))
    except Exception as exc:
        logger.error("[Demo] Redis enqueue failed for %s: %s", invoice_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Demo invoice saved but could not be queued",
        ) from exc

    remaining_after = await record_demo_run(
        redis, token_key=token_key, ip=ip, scenario_id=scenario.id
    )

    return DemoRunResponse(
        invoice_id=invoice_id,
        scenario=scenario.id,
        guest_token=new_token,
        remaining_today=remaining_after,
    )
