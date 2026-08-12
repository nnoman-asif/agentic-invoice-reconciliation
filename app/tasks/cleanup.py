"""
Retention and cleanup tasks.

Usage:
    python -m app.tasks.cleanup

- Delete guest users (and owned data) after 24 hours
- Delete inactive ``kind='user'`` accounts past inactive_account_days
- Expire PDF binaries past pdf_retention_days (keep row + raw_text)
- Never touch the system user or its owned rows
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import SYSTEM_USER_ID, settings
from app.db.session import async_session_factory
from app.models.database import Invoice, User
from app.tools.storage import get_storage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def _delete_user_with_files(session, user: User) -> int:
    """Delete files for the user's invoices, then delete the user row (cascade)."""
    storage = get_storage()
    result = await session.execute(
        select(Invoice).where(Invoice.owner_id == user.id)
    )
    invoices = list(result.scalars().all())
    deleted_files = 0
    for inv in invoices:
        if storage.delete(inv.raw_file_path):
            deleted_files += 1
    await session.delete(user)
    return deleted_files


async def purge_expired_guests() -> tuple[int, int]:
    cutoff = _utc_now() - timedelta(hours=settings.guest_retention_hours)
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(
                User.kind == "guest",
                User.created_at < cutoff,
                User.id != SYSTEM_USER_ID,
            )
        )
        guests = list(result.scalars().all())
        files = 0
        for user in guests:
            files += await _delete_user_with_files(session, user)
        await session.commit()
        logger.info(
            "[Cleanup] Purged %d guest account(s), %d file(s)",
            len(guests),
            files,
        )
        return len(guests), files


async def purge_inactive_users() -> tuple[int, int]:
    cutoff = _utc_now() - timedelta(days=settings.inactive_account_days)
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(
                User.kind == "user",
                User.last_seen_at < cutoff,
                User.id != SYSTEM_USER_ID,
            )
        )
        users = list(result.scalars().all())
        files = 0
        for user in users:
            files += await _delete_user_with_files(session, user)
        await session.commit()
        logger.info(
            "[Cleanup] Purged %d inactive user account(s), %d file(s)",
            len(users),
            files,
        )
        return len(users), files


async def expire_old_pdfs() -> int:
    """Delete PDF binaries older than the retention window; keep DB rows."""
    cutoff = _utc_now() - timedelta(days=settings.pdf_retention_days)
    storage = get_storage()
    async with async_session_factory() as session:
        result = await session.execute(
            select(Invoice)
            .options(selectinload(Invoice.owner))
            .where(
                Invoice.file_deleted_at.is_(None),
                Invoice.raw_file_path.is_not(None),
                Invoice.created_at < cutoff,
                Invoice.owner_id != SYSTEM_USER_ID,
            )
        )
        invoices = list(result.scalars().all())
        expired = 0
        for inv in invoices:
            storage.delete(inv.raw_file_path)
            inv.file_deleted_at = _utc_now()
            # Keep raw_text; clear path so we don't advertise a missing file.
            inv.raw_file_path = None
            expired += 1
        await session.commit()
        logger.info("[Cleanup] Expired %d PDF(s) past retention", expired)
        return expired


async def run_cleanup() -> dict[str, int]:
    guests, guest_files = await purge_expired_guests()
    users, user_files = await purge_inactive_users()
    pdfs = await expire_old_pdfs()
    summary = {
        "guests_deleted": guests,
        "guest_files_deleted": guest_files,
        "users_deleted": users,
        "user_files_deleted": user_files,
        "pdfs_expired": pdfs,
    }
    logger.info("[Cleanup] Done: %s", summary)
    return summary


def main() -> None:
    asyncio.run(run_cleanup())


if __name__ == "__main__":
    main()
