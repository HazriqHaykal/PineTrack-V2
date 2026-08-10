"""
Harvest Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from typing import List
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker, require_admin
from app.schemas import HarvestCreate, HarvestUpdate, HarvestResponse, QualityTargetUpdate, QualityTargetResponse
from app.services.harvest_service import HarvestService

router = APIRouter()


@router.post("/", response_model=HarvestResponse, status_code=status.HTTP_201_CREATED)
def create_harvest(
    harvest_data: HarvestCreate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Create a new harvest record
    
    - **field_name**: Name/identifier of the field
    - **harvest_date**: Date of harvest
    - **quantity_kg**: Harvested quantity in kilograms
    - **quality_grade**: Optional quality grade (A, B, C, D)
    - **notes**: Optional notes about the harvest
    
    Returns the created harvest record with ID and timestamps.
    """
    # Validate harvest data
    is_valid, error_msg = HarvestService.validate_harvest_data(harvest_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Create harvest
    user_id = current_user.get("user_id")
    harvest = HarvestService.create_harvest(db, harvest_data, user_id)
    
    return harvest


@router.get("/{harvest_id}", response_model=HarvestResponse)
def get_harvest(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get harvest record by ID
    
    Workers can only view their own harvests. Admins can view any harvest.
    """
    harvest = HarvestService.get_harvest_by_id(db, harvest_id)
    
    if not harvest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Harvest not found"
        )
    
    # Check authorization
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and harvest.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own harvests"
        )
    
    return harvest


@router.get("/", response_model=dict)
def list_harvests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List harvest records with pagination
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Number of records to return (default: 100, max: 1000)
    
    Workers see only their harvests. Admins see all harvests.
    """
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    # Determine which user_id to filter by
    filter_user_id = None if user_role == "admin" else user_id
    
    harvests, total = HarvestService.list_harvests(db, filter_user_id, skip, limit)
    
    return {
        "items": [HarvestResponse.from_orm(h).__dict__ for h in harvests],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.patch("/{harvest_id}", response_model=HarvestResponse)
def update_harvest(
    harvest_id: int,
    harvest_data: HarvestUpdate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Update harvest record (quality grade or notes)
    
    Workers can only update their own harvests. Admins can update any harvest.
    """
    # Get harvest to check ownership
    harvest = HarvestService.get_harvest_by_id(db, harvest_id)
    
    if not harvest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Harvest not found"
        )
    
    # Check authorization
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and harvest.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own harvests"
        )
    
    # Validate quality grade if provided
    if harvest_data.quality_grade:
        valid_grades = ["A", "B", "C", "D", "ungraded"]
        if harvest_data.quality_grade not in valid_grades:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quality grade must be one of: {', '.join(valid_grades)}"
            )

    # Validate harvest status transition and spoilage/rejection quantities
    is_valid, error_msg = HarvestService.validate_harvest_update(harvest_data, harvest)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    updated_harvest = HarvestService.update_harvest(db, harvest_id, harvest_data)
    return updated_harvest


@router.delete("/{harvest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_harvest(
    harvest_id: int,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Delete harvest record
    
    Only admins can delete harvests.
    """
    user_role = current_user.get("role")
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete harvests"
        )
    
    deleted = HarvestService.delete_harvest(db, harvest_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Harvest not found"
        )
    
    return None


@router.get("/statistics/summary", response_model=dict)
def get_harvest_statistics(
    start_date: date = Query(None),
    end_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get harvest statistics for a date range
    
    - **start_date**: Start date for statistics (optional)
    - **end_date**: End date for statistics (optional)
    
    Workers get their own statistics. Admins get system-wide statistics.
    """
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    filter_user_id = None if user_role == "admin" else user_id
    
    stats = HarvestService.get_harvest_statistics(db, filter_user_id, start_date, end_date)
    
    return stats


@router.get("/field/{field_name}", response_model=dict)
def get_harvests_by_field(
    field_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all harvests from a specific field
    
    Returns all harvest records for the given field name.
    """
    harvests = HarvestService.get_harvests_by_field(db, field_name)
    
    # Workers can only see their own field harvests
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin":
        harvests = [h for h in harvests if h.user_id == user_id]
    
    return {
        "field_name": field_name,
        "count": len(harvests),
        "harvests": [HarvestResponse.from_orm(h).__dict__ for h in harvests]
    }


@router.get("/targets/quality", response_model=QualityTargetResponse)
def get_quality_targets(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the management-defined spoilage/rejection rate targets

    Actual harvest spoilage and rejection rates are compared against these thresholds.
    """
    return HarvestService.get_quality_targets(db)


@router.put("/targets/quality", response_model=QualityTargetResponse)
def update_quality_targets(
    target_data: QualityTargetUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update the management-defined spoilage/rejection rate targets

    Only admins can set these targets.
    """
    return HarvestService.update_quality_targets(db, target_data)
