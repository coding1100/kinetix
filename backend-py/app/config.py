from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_STRIP_QUERY_KEYS = frozenset({"pgbouncer", "connection_limit"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_env: str = "development"
    port: int = 4001
    frontend_url: str = "http://localhost:3001"
    database_url: str
    direct_database_url: str = Field(
        default="",
        validation_alias=AliasChoices("DIRECT_DATABASE_URL", "DIRECT_URL"),
    )
    jwt_access_secret: str
    jwt_refresh_secret: str
    jwt_access_expires_minutes: int = 240  # 4 hours (use 180 for 3h)
    jwt_refresh_expires_days: int = 7
    reset_token_expires_hours: int = 1
    invite_token_expires_days: int = 7
    google_client_id: str = ""
    google_client_secret: str = ""
    api_public_url: str = "http://localhost:4001"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: int = 30
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_attachments_bucket: str = ""
    s3_presign_expires_seconds: int = 900
    attachment_max_bytes: int = 26_214_400

    @property
    def s3_configured(self) -> bool:
        return bool(
            self.aws_access_key_id.strip()
            and self.aws_secret_access_key.strip()
            and self.s3_attachments_bucket.strip()
        )

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host.strip() and (self.smtp_from.strip() or self.smtp_user.strip()))

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def runtime_database_url(self) -> str:
        """Prefer direct URL when set (e.g. migrations); otherwise DATABASE_URL."""
        direct = self.direct_database_url.strip()
        if direct:
            return direct
        return self.database_url

    @property
    def async_database_url(self) -> str:
        url = self.runtime_database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        parsed = urlparse(url)
        query = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k not in _STRIP_QUERY_KEYS
        ]
        return urlunparse(parsed._replace(query=urlencode(query)))

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    @property
    def google_redirect_uri(self) -> str:
        base = self.api_public_url.rstrip("/")
        return f"{base}/api/v1/auth/google/callback"


@lru_cache
def _get_settings_cached() -> Settings:
    return Settings()


def get_settings() -> Settings:
    """In development, re-read .env on each call (uvicorn --reload ignores .env)."""
    fresh = Settings()
    if fresh.is_production:
        return _get_settings_cached()
    return fresh
