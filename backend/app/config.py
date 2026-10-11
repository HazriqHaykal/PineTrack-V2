"""
Database and environment configuration for PineTrack
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def debug(self) -> bool:
        return self.environment == "development"


settings = Settings()

is_sqlite = settings.database_url.startswith("sqlite")

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    # Hosted databases (e.g. Supabase) drop idle connections; check before reuse
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
