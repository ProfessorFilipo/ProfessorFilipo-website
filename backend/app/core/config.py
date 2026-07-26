"""
Application settings, loaded from environment variables (or a local .env
file during development). See backend/.env.example for the full list.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database (raw value, as copied from Neon — e.g. "postgresql://...")
    database_url: str

    @property
    def sqlalchemy_database_url(self) -> str:
        """
        Neon (and most providers) give you a plain "postgresql://" URL, but
        SQLAlchemy defaults that scheme to the psycopg2 driver. We installed
        psycopg3 instead (the modern, actively maintained one), so we rewrite
        the scheme to "postgresql+psycopg://" here — this way you never need
        to manually edit the connection string Neon gives you.
        """
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url

    # Cloudflare R2 (S3-compatible)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_endpoint_url: str = ""

    # Environment
    app_env: str = "local"
    app_debug: bool = True

    # Locales
    default_locale: str = "pt-BR"
    available_locales: str = "pt-BR,en-CA"

    # CORS — comma-separated list of allowed frontend origins
    cors_allowed_origins: str = "http://localhost:3000"

    @property
    def locales_list(self) -> list[str]:
        return [loc.strip() for loc in self.available_locales.split(",")]

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",")]


# Singleton instance, imported elsewhere as `from app.core.config import settings`
settings = Settings()
