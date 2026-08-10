"""
Waste Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker
from app.schemas import WasteCreate, WasteUpdate
from app.services.waste_service import WasteService

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_waste(
    waste_data: WasteCreate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Create a new waste record
    
    - **waste_type**: Type of waste (rotten, damaged, unused_parts, other)
    - **quantity_kg**: Quantity of waste in kilograms
    - **waste_date**: Date waste was recorded
    - **disposal_method**: Disposal method (compost, recycle, discard, donate)
    - **harvest_id**: Optional link to harvest
    - **notes**: Optional notes
    """
    # Validate waste data
    is_valid, error_msg = WasteService.validate_waste_data(waste_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    try:
        user_id = current_user.get("user_id")
        waste = WasteService.create_waste(db, waste_data, user_id)
        return waste
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{waste_id}")
def get_waste(
    waste_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get waste record by ID"""
    waste = WasteService.get_waste_by_id(db, waste_id)
    
    if not waste:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waste record not found"
        )
    
    # Workers can only view their own waste records
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and waste.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own waste records"
        )
    
    return waste


@router.get("/", response_model=dict)
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
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    filter_user_id = None if user_role == "admin" else user_id
    
    waste_records, total = WasteService.list_waste(
        db, filter_user_id, waste_type, skip, limit
    )
    
    return {
        "items": waste_records,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.patch("/{waste_id}")
def update_waste(
    waste_id: int,
    waste_data: WasteUpdate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Update waste record"""
    waste = WasteService.get_waste_by_id(db, waste_id)
    
    if not waste:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Waste record not found"
        )
    
    # Authorization check
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and waste.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own waste records"
        )
    
    try:
        updated = WasteService.update_waste(db, waste_id, waste_data)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{waste_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_waste(
    waste_id: int,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Delete waste record (admin only)"""
    user_role = current_user.get("role")
    
    if user_role != "admin":
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
    """
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    filter_user_id = None if user_role == "admin" else user_id
    
    stats = WasteService.get_waste_statistics(db, filter_user_id, start_date, end_date)
    return stats
