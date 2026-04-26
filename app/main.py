from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import (
    dashboard,
    delivery_receipts,
    exceptions,
    health,
    invoices,
    purchase_orders,
)
from app.api.webhooks import invoice_webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    yield
    await app.state.redis.close()


app = FastAPI(
    title="Invoice Reconciliation Agent",
    description="Multi-agent system for automated 3-way invoice matching with human-in-the-loop",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(purchase_orders.router, prefix="/api", tags=["Purchase Orders"])
app.include_router(delivery_receipts.router, prefix="/api", tags=["Delivery Receipts"])
app.include_router(exceptions.router, prefix="/api", tags=["Exceptions"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(invoice_webhook.router, prefix="/api", tags=["Webhooks"])
