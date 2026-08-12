import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.schemas import HealthResponse
from app.tools.limits import QUEUE_NAME
from app.tools.quota import get_system_quota_status

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request, db: AsyncSession = Depends(get_db)):
    pg_status = "unhealthy"
    redis_status = "unhealthy"
    ollama_status = "skipped"
    queue_depth: int | None = None
    quota_status = "unknown"
    llm_paused = False

    provider = (settings.llm_provider or "ollama").strip().lower()
    chat_provider = f"{provider}:{settings.resolved_chat_model}"
    embedding_provider = f"{provider}:{settings.resolved_embedding_model}"

    try:
        await db.execute(text("SELECT 1"))
        pg_status = "healthy"
    except Exception:
        pass

    redis = getattr(request.app.state, "redis", None)
    try:
        if redis is not None and await redis.ping():
            redis_status = "healthy"
            try:
                queue_depth = int(await redis.llen(QUEUE_NAME))
            except Exception:
                queue_depth = None
            try:
                quota_status, llm_paused = await get_system_quota_status(redis)
            except Exception:
                quota_status = "unknown"
    except Exception:
        pass

    if provider == "ollama":
        ollama_status = "unhealthy"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.ollama_base_url}/api/tags")
                if resp.status_code == 200:
                    ollama_status = "healthy"
        except Exception:
            pass

    if pg_status != "healthy" or redis_status != "healthy":
        overall = "unhealthy"
    elif provider == "ollama" and ollama_status != "healthy":
        overall = "degraded"
    elif quota_status == "limited":
        overall = "degraded"
    else:
        overall = "healthy"

    return HealthResponse(
        status=overall,
        postgres=pg_status,
        redis=redis_status,
        ollama=ollama_status,
        chat_provider=chat_provider,
        embedding_provider=embedding_provider,
        queue_depth=queue_depth,
        quota_status=quota_status,
        llm_paused=llm_paused,
    )
