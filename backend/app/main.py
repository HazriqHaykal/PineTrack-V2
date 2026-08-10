"""
PineTrack V2.0 - FastAPI Backend Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.routers import auth, harvest, transport, waste, schedule, ai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PineTrack V2.0 API",
    description="Farm Management System - Harvest, Transport, Waste, Scheduling",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(harvest.router, prefix="/api/harvest", tags=["harvest"])
app.include_router(transport.router, prefix="/api/transport", tags=["transport"])
app.include_router(waste.router, prefix="/api/waste", tags=["waste"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

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
