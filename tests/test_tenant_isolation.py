"""Tenant isolation regression tests.

Test 1 audits that every protected /api data route depends on get_current_owner.
Test 2 checks cross-user reads cannot see another owner's resources.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import OwnerContext, get_current_owner
from app.db.session import get_db
from app.main import app
from app.models.database import Invoice, PurchaseOrder, User, Vendor


def _route_depends_on_owner(route: APIRoute) -> bool:
    stack = list(route.dependant.dependencies)
    while stack:
        dep = stack.pop()
        if dep.call is get_current_owner:
            return True
        stack.extend(dep.dependencies)
    return False


def test_all_api_routes_require_owner_dependency():
    """Fail if any protected /api data route forgets get_current_owner."""
    # Public mint endpoint — intentionally unauthenticated.
    public = {("POST", "/api/auth/guest")}

    missing: list[str] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not route.path.startswith("/api"):
            continue
        methods = route.methods - {"HEAD"}
        if all((m, route.path) in public for m in methods):
            continue
        if not _route_depends_on_owner(route):
            missing.append(f"{','.join(sorted(methods))} {route.path}")

    assert not missing, (
        "Routes missing get_current_owner dependency:\n  " + "\n  ".join(missing)
    )


def _owner_ctx(user_id: uuid.UUID) -> OwnerContext:
    return OwnerContext(
        user_id=user_id,
        kind="user",
        daily_invoice_limit=15,
        max_upload_mb=10,
        max_pdf_pages=10,
    )


@pytest_asyncio.fixture
async def isolation_client(db_session: AsyncSession):
    """HTTP client bound to the test DB session, lifespan off (no Redis)."""

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.state.redis = AsyncMock()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_cross_user_isolation(
    isolation_client: AsyncClient, db_session: AsyncSession
):
    """User A must not see User B's vendors, POs, or invoices (and vice versa)."""
    now = datetime.now(timezone.utc)
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()

    db_session.add_all(
        [
            User(id=user_a_id, kind="user", display_name="User A", last_seen_at=now),
            User(id=user_b_id, kind="user", display_name="User B", last_seen_at=now),
        ]
    )
    await db_session.flush()

    vendor_a = Vendor(
        owner_id=user_a_id,
        name="Vendor A",
        code="VA-001",
        tax_id="TAX-A",
    )
    vendor_b = Vendor(
        owner_id=user_b_id,
        name="Vendor B",
        code="VB-001",
        tax_id="TAX-B",
    )
    db_session.add_all([vendor_a, vendor_b])
    await db_session.flush()

    po_a = PurchaseOrder(
        owner_id=user_a_id,
        po_number="PO-A-001",
        vendor_id=vendor_a.id,
        issue_date=date(2024, 1, 1),
        status="issued",
        total_amount=100,
        currency="USD",
    )
    po_b = PurchaseOrder(
        owner_id=user_b_id,
        po_number="PO-B-001",
        vendor_id=vendor_b.id,
        issue_date=date(2024, 1, 1),
        status="issued",
        total_amount=200,
        currency="USD",
    )
    db_session.add_all([po_a, po_b])
    await db_session.flush()

    inv_a = Invoice(
        owner_id=user_a_id,
        invoice_number="INV-A-001",
        vendor_id=vendor_a.id,
        processing_status="completed",
        business_status="pending",
    )
    inv_b = Invoice(
        owner_id=user_b_id,
        invoice_number="INV-B-001",
        vendor_id=vendor_b.id,
        processing_status="completed",
        business_status="pending",
    )
    db_session.add_all([inv_a, inv_b])
    await db_session.flush()

    async def _as_user(user_id: uuid.UUID):
        app.dependency_overrides[get_current_owner] = lambda: _owner_ctx(user_id)

    # --- As user A: must see only A's resources ---
    await _as_user(user_a_id)

    vendors = (await isolation_client.get("/api/vendors")).json()
    vendor_ids = {v["id"] for v in vendors}
    assert str(vendor_a.id) in vendor_ids
    assert str(vendor_b.id) not in vendor_ids

    r = await isolation_client.get(f"/api/vendors/{vendor_b.id}")
    assert r.status_code == 404

    pos = (await isolation_client.get("/api/purchase-orders")).json()
    po_ids = {p["id"] for p in pos}
    assert str(po_a.id) in po_ids
    assert str(po_b.id) not in po_ids

    r = await isolation_client.get(f"/api/purchase-orders/{po_b.id}")
    assert r.status_code == 404

    invoices = (await isolation_client.get("/api/invoices")).json()
    inv_ids = {i["id"] for i in invoices}
    assert str(inv_a.id) in inv_ids
    assert str(inv_b.id) not in inv_ids

    r = await isolation_client.get(f"/api/invoices/{inv_b.id}")
    assert r.status_code == 404

    # --- As user B: must see only B's resources ---
    await _as_user(user_b_id)

    vendors = (await isolation_client.get("/api/vendors")).json()
    vendor_ids = {v["id"] for v in vendors}
    assert str(vendor_b.id) in vendor_ids
    assert str(vendor_a.id) not in vendor_ids

    r = await isolation_client.get(f"/api/vendors/{vendor_a.id}")
    assert r.status_code == 404

    pos = (await isolation_client.get("/api/purchase-orders")).json()
    po_ids = {p["id"] for p in pos}
    assert str(po_b.id) in po_ids
    assert str(po_a.id) not in po_ids

    invoices = (await isolation_client.get("/api/invoices")).json()
    inv_ids = {i["id"] for i in invoices}
    assert str(inv_b.id) in inv_ids
    assert str(inv_a.id) not in inv_ids
