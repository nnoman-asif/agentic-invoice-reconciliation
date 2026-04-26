"""Redis queue consumer for processing invoices asynchronously."""

import asyncio
import logging
import uuid

import redis.asyncio as aioredis

from app.config import settings
from app.db.session import async_session_factory
from app.services.invoice_service import process_invoice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

QUEUE_NAME = "invoice_queue"
POLL_INTERVAL = 2  # seconds


async def worker_loop():
    """Main worker loop: poll Redis for invoice processing jobs."""
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("[Worker] Started. Listening for invoice processing jobs...")

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
                logger.error(f"[Worker] Invalid UUID: {invoice_id_str}")
                continue

            async with async_session_factory() as session:
                try:
                    await process_invoice(invoice_id, session)
                    await session.commit()
                    logger.info(f"[Worker] Successfully processed invoice {invoice_id}")
                except Exception as e:
                    await session.rollback()
                    logger.exception(f"[Worker] Failed to process invoice {invoice_id}: {e}")

    except asyncio.CancelledError:
        logger.info("[Worker] Shutting down...")
    finally:
        await redis_client.close()


def main():
    """Entry point for the worker process."""
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
