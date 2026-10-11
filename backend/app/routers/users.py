"""
User Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.config import get_db
from app.middleware.rbac import get_current_user, require_admin
from app.models import User, Schedule
from app.schemas import UserCreate, UserUpdate, UserAdminUpdate, UserResponse, UserListResponse
from app.services.auth_service import create_user, hash_password
from app.services.analytics_service import AnalyticsService

router = APIRouter()

VALID_ROLES = ["admin", "worker", "user"]


def _apply_profile_changes(db: Session, user: User, changes: dict) -> None:
    """Apply name/email/password changes shared by self-service and admin updates"""
    if changes.get("email") and changes["email"] != user.email:
        if db.query(User).filter(User.email == changes["email"], User.id != user.id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
        user.email = changes["email"]

    if "full_name" in changes:
        user.full_name = changes["full_name"]

    if changes.get("password"):
        user.password_hash = hash_password(changes["password"])


@router.get("", response_model=UserListResponse)
def list_users(
    role: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List users (admin only), optionally filtered by role"""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)

    total = query.count()
    users = query.order_by(User.id).offset(skip).limit(limit).all()

    # Task counts per worker for the users on this page
    counts = {}
    user_ids = [u.id for u in users]
    if user_ids:
        for schedule in db.query(Schedule).filter(Schedule.worker_id.in_(user_ids)).all():
            row = counts.setdefault(schedule.worker_id, {"tasks_total": 0, "tasks_completed": 0})
            row["tasks_total"] += 1
            if schedule.status == "completed":
                row["tasks_completed"] += 1

    items = [
        {**UserResponse.model_validate(u).model_dump(), **counts.get(u.id, {})}
        for u in users
    ]

    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user_account(
    user: UserCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a user with any role (admin only)"""
    if user.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(VALID_ROLES)}"
        )

    existing = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")

    return create_user(db, user.username, user.email, user.password, role=user.role, full_name=user.full_name)


@router.get("/me/stats")
def get_my_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """The current user's own activity totals"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return AnalyticsService.get_user_stats(db, user)


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's own name, email or password"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    _apply_profile_changes(db, user, data.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserAdminUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a user's profile, role or active status (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes = data.model_dump(exclude_unset=True)
    is_self = user.id == current_user["user_id"]

    if changes.get("role") is not None:
        if changes["role"] not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role must be one of: {', '.join(VALID_ROLES)}"
            )
        if is_self and changes["role"] != "admin":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own admin role")
        user.role = changes["role"]

    if changes.get("is_active") is not None:
        if is_self and not changes["is_active"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")
        user.is_active = changes["is_active"]

    _apply_profile_changes(db, user, changes)
    db.commit()
    db.refresh(user)
    return user
