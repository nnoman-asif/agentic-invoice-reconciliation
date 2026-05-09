"""Redis queue consumer for processing invoices asynchronously."""

import asyncio
import logging
import uuid

import redis.asyncio as aioredis

from app.config import settings
from app.db.session import async_session_factory
from app.services.invoice_service import (
    OUTCOME_FAILED,
    OUTCOME_SKIPPED_NOT_FOUND,
    OUTCOME_SUCCEEDED,
    process_invoice,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

QUEUE_NAME = "invoice_queue"
POLL_INTERVAL = 2  # seconds

# Transient "not found" recovery: re-enqueue the job up to N times with
# a small backoff. Covers the brief window where an upload's commit and
# the worker's SELECT race across connections.
MAX_NOT_FOUND_RETRIES = 3
NOT_FOUND_BACKOFF_SEC = 1.0


async def worker_loop():
    """Main worker loop: poll Redis for invoice processing jobs."""
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("[Worker] Started. Listening for invoice processing jobs...")

    # Track per-invoice retry attempts for transient races. Cleared on
    # final outcome (success or permanent drop).
    retry_counts: dict[str, int] = {}

    try:
        while True:
            result = await redis_client.brpop(QUEUE_NAME, timeout=POLL_INTERVAL)

            if result is None:
                continue

            _, invoice_id_str = result
            logger.info(f"[Worker] Picked up job: invoice {invoice_id_str}")

            try:
                invoice_id = uuid.UUID(invoice_id_str)
            except ValueError:
                logger.error(f"[Worker] Dropped invalid UUID: {invoice_id_str}")
                continue

            outcome = OUTCOME_FAILED
            async with async_session_factory() as session:
                try:
                    outcome = await process_invoice(invoice_id, session)
                    await session.commit()
                except Exception as e:
                    await session.rollback()
                    outcome = OUTCOME_FAILED
                    logger.exception(
                        f"[Worker] Failed invoice {invoice_id} (uncaught): {e}"
                    )

            if outcome == OUTCOME_SUCCEEDED:
                retry_counts.pop(invoice_id_str, None)
                logger.info(f"[Worker] Successfully processed invoice {invoice_id}")
            elif outcome == OUTCOME_FAILED:
                retry_counts.pop(invoice_id_str, None)
                logger.error(
                    f"[Worker] Failed invoice {invoice_id} (recorded as failed)"
                )
            elif outcome == OUTCOME_SKIPPED_NOT_FOUND:
                attempts = retry_counts.get(invoice_id_str, 0) + 1
                if attempts < MAX_NOT_FOUND_RETRIES:
                    retry_counts[invoice_id_str] = attempts
                    logger.warning(
                        f"[Worker] Skipped invoice {invoice_id} -- not found, "
                        f"requeuing attempt {attempts}/{MAX_NOT_FOUND_RETRIES} "
                        f"in {NOT_FOUND_BACKOFF_SEC}s"
                    )
                    await asyncio.sleep(NOT_FOUND_BACKOFF_SEC)
                    await redis_client.lpush(QUEUE_NAME, invoice_id_str)
                else:
                    logger.error(
                        f"[Worker] Permanently dropped invoice {invoice_id} "
                        f"(not found after {MAX_NOT_FOUND_RETRIES} attempts)"
                    )
                    retry_counts.pop(invoice_id_str, None)
            else:
                # Unknown outcome -- treat as failure to avoid silent loss
                retry_counts.pop(invoice_id_str, None)
                logger.error(
                    f"[Worker] Unknown outcome '{outcome}' for invoice {invoice_id}"
                )

    except asyncio.CancelledError:
        logger.info("[Worker] Shutting down...")
    finally:
        await redis_client.close()


def main():
    """Entry point for the worker process."""
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
