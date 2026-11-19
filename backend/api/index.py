"""
Vercel serverless entry point. Vercel runs this file and serves the FastAPI app;
backend/vercel.json routes every request here.
"""

import os
import sys

# Make the backend folder importable so "from app..." works on Vercel
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import Base, engine  # noqa: E402
from app.main import app  # noqa: E402,F401 - Vercel looks for "app"

# Serverless functions may skip FastAPI's startup hook, so make sure tables exist here
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:  # don't crash the function if the DB is briefly unreachable
    print(f"create_all failed: {e}")
