"""
Transport Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker
from app.schemas import TransportCreate, TransportUpdate
from app.services.transport_service import TransportService

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_transport(
    transport_data: TransportCreate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Create a new transport record
    
    - **harvest_id**: ID of harvest to transport
    - **destination**: Transport destination
    - **transport_date**: Date of transport
    - **vehicle_id**: Optional vehicle identifier
    - **quantity_kg**: Quantity to transport
    - **notes**: Optional notes
    """
    # Validate transport data
    is_valid, error_msg = TransportService.validate_transport_data(transport_data, db)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    try:
        user_id = current_user.get("user_id")
        transport = TransportService.create_transport(db, transport_data, user_id)
        return transport
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{transport_id}")
def get_transport(
    transport_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transport record by ID"""
    transport = TransportService.get_transport_by_id(db, transport_id)
    
    if not transport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transport not found"
        )
    
    # Workers can only view their own transports
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and transport.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own transports"
        )
    
    return transport


@router.get("/", response_model=dict)
def list_transports(
    status: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List transport records with filtering
    
    - **status**: Filter by status (pending, in_transit, delivered, cancelled)
    - **skip**: Pagination offset
    - **limit**: Pagination limit
    """
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    filter_user_id = None if user_role == "admin" else user_id
    
    transports, total = TransportService.list_transports(
        db, filter_user_id, status, skip, limit
    )
    
    return {
        "items": transports,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.patch("/{transport_id}")
def update_transport(
    transport_id: int,
    transport_data: TransportUpdate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Update transport record"""
    transport = TransportService.get_transport_by_id(db, transport_id)
    
    if not transport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transport not found"
        )
    
    # Authorization check
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and transport.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own transports"
        )
    
    try:
        updated = TransportService.update_transport(db, transport_id, transport_data)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{transport_id}/status")
def update_transport_status(
    transport_id: int,
    new_status: str = Query(...),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Update transport status
    
    Valid statuses: pending → in_transit → delivered, cancelled
    """
    transport = TransportService.get_transport_by_id(db, transport_id)
    
    if not transport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transport not found"
        )
    
    # Workers can only update their own transports
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and transport.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own transports"
        )
    
    try:
        updated = TransportService.update_transport_status(db, transport_id, new_status)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{transport_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transport(
    transport_id: int,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Delete transport record (admin only)"""
    user_role = current_user.get("role")
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete transports"
        )
    
    deleted = TransportService.delete_transport(db, transport_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transport not found"
        )
    
    return None


@router.get("/efficiency/statistics", response_model=dict)
def get_transport_efficiency(
    start_date: date = Query(None),
    end_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transport efficiency statistics
    
    - **start_date**: Start date for statistics
    - **end_date**: End date for statistics
    """
    stats = TransportService.get_transport_efficiency_stats(db, start_date, end_date)
    return stats


@router.get("/destination/{destination}", response_model=dict)
def get_transports_by_destination(
    destination: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transports to a specific destination"""
    transports = TransportService.get_transports_by_destination(db, destination)
    
    # Workers can only see their own transports
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin":
        transports = [t for t in transports if t.user_id == user_id]
    
    return {
        "destination": destination,
        "count": len(transports),
        "transports": transports
    }
