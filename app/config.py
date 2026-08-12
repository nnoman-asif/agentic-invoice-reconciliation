from pydantic_settings import BaseSettings
import uuid


# Hardcoded bootstrap user IDs — also inserted by setup_db.py.
# System owns the shared demo reference data; local-dev is returned by
# get_current_owner when auth is disabled.
SYSTEM_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
LOCAL_DEV_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "invoice_reconciliation"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # LLM provider: "ollama" (local) or "gemini" (remote)
    llm_provider: str = "ollama"
    gemini_api_key: str = ""
    # Empty = provider default (see resolved_* properties). Set explicitly
    # when switching providers, e.g. gemini-2.0-flash / gemini-embedding-2 / 1536.
    chat_model: str = ""
    embedding_model: str = ""
    embedding_dim: int = 0

    # Ollama connection + legacy env aliases (OLLAMA_LLM_MODEL etc.)
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "qwen2.5:7b"
    ollama_embedding_model: str = "qwen3-embedding:0.6b"
    ollama_embedding_dim: int = 1024

    # FastAPI
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_env: str = "development"
    app_debug: bool = True
    # Comma-separated browser origins for CORS (credentials enabled).
    allowed_origins: str = (
        "http://localhost:5173,http://localhost:3000,"
        "http://127.0.0.1:5173,http://127.0.0.1:3000"
    )

    # Langfuse — empty host means localhost in development, cloud otherwise.
    langfuse_enabled: bool = False
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_host: str = ""

    # Agent Config
    price_deviation_threshold: float = 5.0
    quantity_mismatch_threshold: float = 0.0

    # File Upload
    upload_dir: str = "uploads/invoices"
    max_upload_size_mb: int = 10
    # Reject extracted text longer than this (never truncate).
    max_pdf_chars: int = 100_000

    # Auth (false = local-dev owner; true = Firebase / guest tokens)
    auth_enabled: bool = False
    firebase_project_id: str = ""
    # Inline service-account JSON (preferred for PaaS). Alternatively set
    # GOOGLE_APPLICATION_CREDENTIALS to a credentials file path.
    firebase_credentials_json: str = ""
    secret_key: str = "dev-only-change-me"
    inactive_account_days: int = 7
    guest_retention_hours: int = 24
    # PDF binaries older than this are deleted; invoice row + raw_text remain.
    pdf_retention_days: int = 7

    # Demo
    demo_runs_per_day: int = 3
    # Only trust CF-Connecting-IP when the app sits behind the Cloudflare Worker.
    trust_proxy_header: bool = False

    # Rate limits / queue fairness (Commit 12)
    upload_rate_per_minute: int = 3
    max_inflight_per_user: int = 1
    # Safety TTL so a crashed worker cannot permanently hold a slot.
    inflight_ttl_seconds: int = 3600
    provider_rpm_limit: int = 20
    provider_retry_max: int = 4

    # Daily quota (Commit 13) — charged at provider call, not upload
    daily_invoice_limit_default: int = 15
    global_chat_daily_cap: int = 1000

    # Quota increase Discord notify (Commit 14). Real URL belongs in .env only.
    discord_webhook_url: str | None = None

    @property
    def resolved_chat_model(self) -> str:
        if self.chat_model:
            return self.chat_model
        if (self.llm_provider or "").strip().lower() == "gemini":
            return "gemini-2.0-flash"
        return self.ollama_llm_model or "qwen2.5:7b"

    @property
    def resolved_embedding_model(self) -> str:
        if self.embedding_model:
            return self.embedding_model
        if (self.llm_provider or "").strip().lower() == "gemini":
            return "gemini-embedding-2"
        return self.ollama_embedding_model or "qwen3-embedding:0.6b"

    @property
    def resolved_embedding_dim(self) -> int:
        if self.embedding_dim:
            return self.embedding_dim
        if (self.llm_provider or "").strip().lower() == "gemini":
            return 1536
        return self.ollama_embedding_dim or 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def resolved_langfuse_host(self) -> str:
        if self.langfuse_host:
            return self.langfuse_host
        if (self.app_env or "").strip().lower() == "development":
            return "http://localhost:3000"
        return "https://cloud.langfuse.com"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


settings = Settings()
