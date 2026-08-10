"""
Authentication service with password hashing and JWT token creation
"""

from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.config import settings
from app.models import User
from sqlalchemy.orm import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_id: int, role: str, expires_delta: timedelta = None) -> str:
    """Create JWT token"""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    
    expire = datetime.utcnow() + expires_delta
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token


def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user by username and password"""
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, username: str, email: str, password: str, role: str = "worker") -> User:
    """Create new user"""
    hashed_pw = hash_password(password)
    user = User(username=username, email=email, password_hash=hashed_pw, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
