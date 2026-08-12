"""Retention cleanup: guests, inactive users, PDF expiry, system-data safety."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.config import LOCAL_DEV_USER_ID, SYSTEM_USER_ID, settings
from app.db.session import async_session_factory, engine
from app.models.database import Invoice, User, Vendor
from app.tasks.cleanup import run_cleanup
from app.tools.storage import get_storage


@pytest.fixture(autouse=True)
async def _dispose_shared_engine():
    """The app engine is process-global; pytest-asyncio uses a new loop per test."""
    yield
    await engine.dispose()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _write_pdf(invoice_id: uuid.UUID, payload: bytes) -> str:
    storage = get_storage()
    return storage.write_bytes(f"{invoice_id}.pdf", payload)


async def _count(session, model, **filters) -> int:
    stmt = select(func.count()).select_from(model)
    for col, val in filters.items():
        stmt = stmt.where(getattr(model, col) == val)
    return int((await session.execute(stmt)).scalar_one())


@pytest.mark.asyncio
async def test_cleanup_purges_old_guest_with_files_and_keeps_fresh_guest():
    old_id = uuid.uuid4()
    fresh_id = uuid.uuid4()
    inv_id = uuid.uuid4()
    now = _utc_now()
    file_path = _write_pdf(inv_id, b"%PDF-1.4\nguest-file\n")
    disk = Path(file_path)
    if not disk.is_file():
        disk = Path(settings.upload_dir) / f"{inv_id}.pdf"

    async with async_session_factory() as session:
        session.add(
            User(
                id=old_id,
                kind="guest",
                display_name="Old Guest",
                last_seen_at=now - timedelta(hours=48),
                created_at=now - timedelta(hours=48),
            )
        )
        session.add(
            User(
                id=fresh_id,
                kind="guest",
                display_name="Fresh Guest",
                last_seen_at=now,
                created_at=now,
            )
        )
        await session.flush()
        session.add(
            Invoice(
                id=inv_id,
                owner_id=old_id,
                processing_status="completed",
                business_status="pending",
                raw_file_path=file_path,
                currency="USD",
                created_at=now - timedelta(hours=48),
            )
        )
        await session.commit()

    try:
        summary = await run_cleanup()
        assert summary["guests_deleted"] >= 1

        async with async_session_factory() as session:
            assert await _count(session, User, id=old_id) == 0
            assert await _count(session, User, id=fresh_id) == 1
            assert await _count(session, Invoice, id=inv_id) == 0
        assert not disk.exists()
    finally:
        async with async_session_factory() as session:
            leftover = await session.get(User, fresh_id)
            if leftover is not None:
                await session.delete(leftover)
                await session.commit()
        if disk.exists():
            disk.unlink()


@pytest.mark.asyncio
async def test_cleanup_purges_inactive_user():
    user_id = uuid.uuid4()
    now = _utc_now()
    async with async_session_factory() as session:
        session.add(
            User(
                id=user_id,
                kind="user",
                display_name="Stale User",
                last_seen_at=now - timedelta(days=settings.inactive_account_days + 1),
                created_at=now - timedelta(days=30),
            )
        )
        await session.commit()

    summary = await run_cleanup()
    assert summary["users_deleted"] >= 1

    async with async_session_factory() as session:
        assert await _count(session, User, id=user_id) == 0


@pytest.mark.asyncio
async def test_cleanup_expires_old_pdf_but_keeps_row_and_raw_text():
    inv_id = uuid.uuid4()
    now = _utc_now()
    file_path = _write_pdf(inv_id, b"%PDF-1.4\nretained-text-pdf\n")
    disk = Path(file_path)
    if not disk.is_file():
        disk = Path(settings.upload_dir) / f"{inv_id}.pdf"

    async with async_session_factory() as session:
        session.add(
            Invoice(
                id=inv_id,
                owner_id=LOCAL_DEV_USER_ID,
                processing_status="completed",
                business_status="approved",
                raw_file_path=file_path,
                raw_text="extracted text stays",
                currency="USD",
                created_at=now - timedelta(days=settings.pdf_retention_days + 1),
            )
        )
        await session.commit()

    try:
        summary = await run_cleanup()
        assert summary["pdfs_expired"] >= 1

        async with async_session_factory() as session:
            inv = await session.get(Invoice, inv_id)
            assert inv is not None
            assert inv.raw_text == "extracted text stays"
            assert inv.file_deleted_at is not None
            assert inv.raw_file_path is None
        assert not disk.exists()
    finally:
        async with async_session_factory() as session:
            inv = await session.get(Invoice, inv_id)
            if inv is not None:
                await session.delete(inv)
                await session.commit()
        if disk.exists():
            disk.unlink()


@pytest.mark.asyncio
async def test_cleanup_leaves_system_and_local_dev_untouched():
    async with async_session_factory() as session:
        sys_vendors_before = await _count(session, Vendor, owner_id=SYSTEM_USER_ID)
        sys_user_before = await _count(session, User, id=SYSTEM_USER_ID)
        local_before = await _count(session, User, id=LOCAL_DEV_USER_ID)

    summary = await run_cleanup()
    assert isinstance(summary, dict)

    async with async_session_factory() as session:
        assert await _count(session, User, id=SYSTEM_USER_ID) == sys_user_before == 1
        assert await _count(session, User, id=LOCAL_DEV_USER_ID) == local_before == 1
        assert await _count(session, Vendor, owner_id=SYSTEM_USER_ID) == sys_vendors_before


@pytest.mark.asyncio
async def test_run_cleanup_exits_cleanly():
    summary = await run_cleanup()
    assert set(summary) == {
        "guests_deleted",
        "guest_files_deleted",
        "users_deleted",
        "user_files_deleted",
        "pdfs_expired",
    }
    assert all(isinstance(v, int) and v >= 0 for v in summary.values())
