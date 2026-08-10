"""
Authentication API endpoints for login, registration, and token refresh
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config import get_db
from app.schemas import LoginRequest, UserCreate, UserResponse, TokenResponse
from app.services.auth_service import authenticate_user, create_user, create_access_token
from app.middleware.rbac import get_current_user, security
from app.models import User

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register new user (worker role by default)"""
    # Check if user exists
    existing = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Create user
    new_user = create_user(db, user.username, user.email, user.password)
    token = create_access_token(new_user.id, new_user.role)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(new_user)
    }


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login with username and password"""
    user = authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user.id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current authenticated user info"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(credentials = Depends(security), db: Session = Depends(get_db)):
    """Refresh expired token"""
    from app.middleware.rbac import verify_token
    current_user = verify_token(credentials)
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_token = create_access_token(user.id, user.role)
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }
