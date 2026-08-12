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

from sqlalchemy import delete as sql_delete
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import LOCAL_DEV_USER_ID, SYSTEM_USER_ID, settings
from app.db.session import async_session_factory
from app.models.database import Invoice, User
from app.tools.storage import get_storage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Bootstrap identities must survive retention (local-dev is kind='user').
_PROTECTED_USER_IDS = (SYSTEM_USER_ID, LOCAL_DEV_USER_ID)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _unlink_paths(paths: list[str]) -> int:
    storage = get_storage()
    deleted = 0
    for path in paths:
        if storage.delete(path):
            deleted += 1
    return deleted


async def _collect_invoice_paths(session, user_id) -> list[str]:
    result = await session.execute(
        select(Invoice.raw_file_path).where(Invoice.owner_id == user_id)
    )
    return [p for p in result.scalars().all() if p]


async def _delete_user_row(session, user: User) -> list[str]:
    """Collect invoice file paths and delete the user row (DB cascade).

    Files are *not* unlinked here. The caller must commit first, then
    unlink, so a failed flush cannot leave rows pointing at missing PDFs.
    """
    paths = await _collect_invoice_paths(session, user.id)
    await session.execute(sql_delete(User).where(User.id == user.id))
    return paths


async def purge_expired_guests() -> tuple[int, int]:
    cutoff = _utc_now() - timedelta(hours=settings.guest_retention_hours)
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(
                User.kind == "guest",
                User.created_at < cutoff,
                User.id.notin_(_PROTECTED_USER_IDS),
            )
        )
        guests = list(result.scalars().all())
        pending_paths: list[str] = []
        for user in guests:
            pending_paths.extend(await _delete_user_row(session, user))
        await session.commit()
        files = _unlink_paths(pending_paths)
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
                User.id.notin_(_PROTECTED_USER_IDS),
            )
        )
        users = list(result.scalars().all())
        pending_paths: list[str] = []
        for user in users:
            pending_paths.extend(await _delete_user_row(session, user))
        await session.commit()
        files = _unlink_paths(pending_paths)
        logger.info(
            "[Cleanup] Purged %d inactive user account(s), %d file(s)",
            len(users),
            files,
        )
        return len(users), files


async def expire_old_pdfs() -> int:
    """Delete PDF binaries older than the retention window; keep DB rows."""
    cutoff = _utc_now() - timedelta(days=settings.pdf_retention_days)
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
        pending_paths: list[str] = []
        expired = 0
        for inv in invoices:
            if inv.raw_file_path:
                pending_paths.append(inv.raw_file_path)
            inv.file_deleted_at = _utc_now()
            # Keep raw_text; clear path so we don't advertise a missing file.
            inv.raw_file_path = None
            expired += 1
        await session.commit()
        _unlink_paths(pending_paths)
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
