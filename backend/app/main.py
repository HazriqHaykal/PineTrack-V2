"""
PineTrack V2.0 - FastAPI Backend Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from sqlalchemy import text
from app.config import Base, engine, is_sqlite
from app import models  # noqa: F401 - registers the tables on Base.metadata
from app.routers import auth, harvest, transport, waste, schedule, ai, reports, users, analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def enable_row_level_security() -> None:
    """
    Lock the tables against Supabase's public REST API.

    Supabase exposes every table in the public schema through an auto-generated API
    unless row level security is on. This backend connects as the table owner, which
    is not subject to RLS, so it keeps full access while outside access is blocked.
    """
    try:
        with engine.begin() as conn:
            for table in Base.metadata.sorted_tables:
                conn.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))
    except Exception as e:
        logger.warning(f"Could not enable row level security: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables so a fresh database works out of the box
    Base.metadata.create_all(bind=engine)
    if not is_sqlite:
        enable_row_level_security()
    yield


app = FastAPI(
    title="PineTrack V2.0 API",
    description="Farm Management System - Harvest, Transport, Waste, Scheduling",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(harvest.router, prefix="/api/harvest", tags=["harvest"])
app.include_router(transport.router, prefix="/api/transport", tags=["transport"])
app.include_router(waste.router, prefix="/api/waste", tags=["waste"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PineTrack V2.0 API",
        "version": "2.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
