"""
Waste Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker
from app.schemas import WasteCreate, WasteUpdate, WasteResponse, WasteListResponse
from app.services.waste_service import WasteService
from app.models import Harvest

router = APIRouter()


def _get_owned_waste(db: Session, waste_id: int, current_user: dict, action: str):
    """Load a waste record, enforcing that workers only touch their own records"""
    waste = WasteService.get_waste_by_id(db, waste_id)

    if not waste:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waste record not found"
        )

    if current_user.get("role") != "admin" and waste.user_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only {action} your own waste records"
        )

    return waste


def _check_batch_access(db: Session, harvest_id, current_user: dict) -> None:
    """Workers can only link waste to harvest batches they recorded themselves"""
    if harvest_id is None or current_user.get("role") == "admin":
        return
    harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
    if harvest and harvest.user_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only link waste to your own harvest batches"
        )


@router.post("", response_model=WasteResponse, status_code=status.HTTP_201_CREATED)
def create_waste(
    waste_data: WasteCreate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Create a new waste record

    - **waste_type**: Type of waste (rotten, damaged, overripe, unused_parts, other)
    - **quantity_kg**: Quantity of waste in kilograms
    - **classification**: compostable, recyclable or non-recyclable
    - **disposal_method**: Optional disposal method
    - **waste_date**: Date waste was recorded (defaults to today)
    - **harvest_id**: Optional link to harvest
    - **notes**: Optional notes
    """
    is_valid, error_msg = WasteService.validate_waste_data(waste_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    _check_batch_access(db, waste_data.harvest_id, current_user)

    try:
        return WasteService.create_waste(db, waste_data, current_user.get("user_id"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=WasteListResponse)
def list_waste(
    waste_type: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List waste records with filtering

    - **waste_type**: Filter by waste type
    - **skip**: Pagination offset
    - **limit**: Pagination limit
    """
    filter_user_id = None if current_user.get("role") == "admin" else current_user.get("user_id")

    waste_records, total = WasteService.list_waste(
        db, filter_user_id, waste_type, skip, limit
    )

    return {
        "items": waste_records,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# Fixed paths are declared before /{waste_id} so they are not captured by it
@router.get("/stats", response_model=dict)
@router.get("/statistics/summary", response_model=dict)
def get_waste_statistics(
    start_date: date = Query(None),
    end_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get waste statistics

    - **start_date**: Start date for statistics
    - **end_date**: End date for statistics

    Workers get their own statistics. Admins get system-wide statistics.
    """
    filter_user_id = None if current_user.get("role") == "admin" else current_user.get("user_id")
    return WasteService.get_waste_statistics(db, filter_user_id, start_date, end_date)


@router.get("/{waste_id}", response_model=WasteResponse)
def get_waste(
    waste_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get waste record by ID"""
    return _get_owned_waste(db, waste_id, current_user, "view")


@router.put("/{waste_id}", response_model=WasteResponse)
@router.patch("/{waste_id}", response_model=WasteResponse)
def update_waste(
    waste_id: int,
    waste_data: WasteUpdate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Update waste record (only the fields provided are changed)"""
    _get_owned_waste(db, waste_id, current_user, "update")
    _check_batch_access(db, waste_data.harvest_id, current_user)

    try:
        return WasteService.update_waste(db, waste_id, waste_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{waste_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_waste(
    waste_id: int,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Delete waste record (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete waste records"
        )

    deleted = WasteService.delete_waste(db, waste_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waste record not found"
        )

    return None
