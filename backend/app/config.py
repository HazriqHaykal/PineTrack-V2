"""
Database and environment configuration for PineTrack
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings, SettingsConfigDict


# Frontends that must always be able to reach the API, even if ALLOWED_ORIGINS
# is set to something else in the Vercel dashboard.
REQUIRED_ORIGINS = [
    "https://pine-track-v2-gcaj.vercel.app",  # deployed frontend
    "http://localhost:5173",  # Vite dev server
]


class Settings(BaseSettings):
    # SQLite by default so the API runs without a database server.
    # Set DATABASE_URL=postgresql://user:password@localhost:5432/pinetrack to use PostgreSQL.
    database_url: str = "sqlite:///./pinetrack.db"
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    environment: str = "development"

    # Google Gemini powers the AI recommendations. Without a key the API
    # falls back to built-in rules so every AI endpoint still responds.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    # Extra comma-separated frontend URLs allowed to call the API (CORS).
    # These are added to REQUIRED_ORIGINS below, never replace them.
    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        """Exact origins (scheme + host, no trailing slash) the browser may call from."""
        extra = [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]
        return list(dict.fromkeys(REQUIRED_ORIGINS + extra))

    @property
    def debug(self) -> bool:
        return self.environment == "development"


settings = Settings()

is_sqlite = settings.database_url.startswith("sqlite")

engine_options = {
    "connect_args": {"check_same_thread": False} if is_sqlite else {},
    # Hosted databases (e.g. Supabase) drop idle connections; check before reuse
    "pool_pre_ping": True,
}
if os.environ.get("VERCEL"):
    # Serverless: each function instance is short-lived, so don't hold a pool open.
    # Supabase's pooler does the pooling instead.
    engine_options["poolclass"] = NullPool

engine = create_engine(settings.database_url, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
