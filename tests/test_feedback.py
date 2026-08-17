import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.api.deps import OwnerContext, get_current_owner
from app.main import app


@pytest.mark.asyncio
async def test_feedback_registered_user():
    fake_user = OwnerContext(
        user_id=uuid.uuid4(),
        kind="registered",
        daily_invoice_limit=15,
        max_upload_mb=10,
        max_pdf_pages=50,
        email="testuser@example.com",
        display_name="Test User",
    )
    app.dependency_overrides[get_current_owner] = lambda: fake_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/feedback",
                json={
                    "category": "suggestion",
                    "subject": "Add dark mode toggle to navigation",
                    "message": "It would be great to have a faster toggle in the top bar.",
                },
            )
            assert response.status_code == 201
            data = response.json()
            assert data["status"] == "received"
            assert data["category"] == "suggestion"
    finally:
        app.dependency_overrides.pop(get_current_owner, None)


@pytest.mark.asyncio
async def test_feedback_guest_user_forbidden():
    fake_guest = OwnerContext(
        user_id=uuid.uuid4(),
        kind="guest",
        daily_invoice_limit=3,
        max_upload_mb=10,
        max_pdf_pages=10,
    )
    app.dependency_overrides[get_current_owner] = lambda: fake_guest
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/feedback",
                json={
                    "category": "suggestion",
                    "subject": "Add dark mode toggle",
                    "message": "Some message",
                },
            )
            assert response.status_code == 403
            assert "only available for registered accounts" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_owner, None)


@pytest.mark.asyncio
async def test_feedback_quota_increase_invalid_limit():
    fake_user = OwnerContext(
        user_id=uuid.uuid4(),
        kind="registered",
        daily_invoice_limit=15,
        max_upload_mb=10,
        max_pdf_pages=50,
        email="testuser@example.com",
        display_name="Test User",
    )
    app.dependency_overrides[get_current_owner] = lambda: fake_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # requested_limit <= current limit (15)
            response = await client.post(
                "/api/feedback",
                json={
                    "category": "quota_increase",
                    "subject": "Need more invoices",
                    "message": "Testing high volume pipeline.",
                    "requested_limit": 10,
                },
            )
            assert response.status_code == 400
            assert "requested_limit must be greater than your current limit" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_owner, None)


