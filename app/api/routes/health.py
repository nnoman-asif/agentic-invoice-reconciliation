import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request, db: AsyncSession = Depends(get_db)):
    pg_status = "unhealthy"
    redis_status = "unhealthy"
    ollama_status = "unhealthy"

    try:
        await db.execute(text("SELECT 1"))
        pg_status = "healthy"
    except Exception:
        pass

    try:
        pong = await request.app.state.redis.ping()
        if pong:
            redis_status = "healthy"
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                ollama_status = "healthy"
    except Exception:
        pass

    overall = "healthy" if all(
        s == "healthy" for s in [pg_status, redis_status, ollama_status]
    ) else "degraded"

    return HealthResponse(
        status=overall,
        postgres=pg_status,
        redis=redis_status,
        ollama=ollama_status,
    )
