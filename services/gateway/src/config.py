"""
config.py
---------
12-Factor App configuration via environment variables.
All secrets are loaded from GCP Secret Manager in production.
"""

from functools import lru_cache
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "aria-gateway"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", pattern="^(development|staging|production)$")
    log_level: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # ── GCP ──────────────────────────────────────────────────────────────────
    gcp_project_id: str = Field(default="aria-dev")
    gemini_model: str = Field(default="gemini-2.0-flash-live-001")
    gemini_location: str = Field(default="us-central1")

    # ── Auth ─────────────────────────────────────────────────────────────────
    jwt_public_key_path: str = Field(default="keys/public.pem")
    jwt_algorithm: str = Field(default="RS256")
    jwt_audience: str = Field(default="aria-gateway")

    # ── Services ─────────────────────────────────────────────────────────────
    memory_service_url: str = Field(default="http://localhost:8001")
    guardrail_service_url: str = Field(default="http://localhost:8002")

    # ── Audio ────────────────────────────────────────────────────────────────
    audio_sample_rate: int = Field(default=16000)
    audio_chunk_size_bytes: int = Field(default=3200)  # 100ms at 16kHz 16-bit mono

    # ── Rate Limiting ────────────────────────────────────────────────────────
    max_connections_per_device: int = Field(default=1)
    max_session_duration_seconds: int = Field(default=1800)  # 30 minutes


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance. Use dependency injection in FastAPI."""
    return Settings()
