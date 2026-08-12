from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import (
    auth,
    dashboard,
    delivery_receipts,
    demo,
    exceptions,
    health,
    invoices,
    purchase_orders,
    quota,
    vendors,
)
from app.api.webhooks import invoice_webhook
from app.auth.firebase import init_firebase


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload root exists without mounting it publicly.
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.state.redis = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    if settings.auth_enabled:
        init_firebase()
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
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(demo.router, prefix="/api", tags=["Demo"])
app.include_router(quota.router, prefix="/api", tags=["Quota"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(purchase_orders.router, prefix="/api", tags=["Purchase Orders"])
app.include_router(delivery_receipts.router, prefix="/api", tags=["Delivery Receipts"])
app.include_router(exceptions.router, prefix="/api", tags=["Exceptions"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(vendors.router, prefix="/api", tags=["Vendors"])
app.include_router(invoice_webhook.router, prefix="/api", tags=["Webhooks"])
