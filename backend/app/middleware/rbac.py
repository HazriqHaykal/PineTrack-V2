"""
Role-Based Access Control middleware for protecting routes
"""

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Decode and verify JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": int(user_id), "role": payload.get("role")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_admin(current_user: dict = Depends(verify_token)) -> dict:
    """Require admin role"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_worker(current_user: dict = Depends(verify_token)) -> dict:
    """Require worker or admin role"""
    if current_user.get("role") not in ["worker", "admin"]:
        raise HTTPException(status_code=403, detail="Worker access required")
    return current_user


def get_current_user(current_user: dict = Depends(verify_token)) -> dict:
    """Get current authenticated user"""
    return current_user
