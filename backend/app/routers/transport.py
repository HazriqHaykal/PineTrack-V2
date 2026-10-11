"""
Transport Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker
from app.schemas import TransportCreate, TransportUpdate, TransportResponse, TransportListResponse
from app.services.transport_service import TransportService

router = APIRouter()


def _get_owned_transport(db: Session, transport_id: int, current_user: dict, action: str):
    """Load a transport, enforcing that workers only touch their own records"""
    transport = TransportService.get_transport_by_id(db, transport_id)

    if not transport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transport not found"
        )

    user_id = current_user.get("user_id")
    if current_user.get("role") != "admin" and user_id not in (transport.user_id, transport.driver_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only {action} your own transports"
        )

    return transport


@router.post("", response_model=TransportResponse, status_code=status.HTTP_201_CREATED)
def create_transport(
    transport_data: TransportCreate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Create a new transport record

    - **destination**: Transport destination
    - **driver_name**: Name of the driver
    - **vehicle_number**: Vehicle plate number
    - **scheduled_date**: Planned delivery date
    - **cargo_weight_kg**: Optional cargo weight
    - **harvest_id**: Optional harvest batch being transported
    - **notes**: Optional notes
    """
    is_valid, error_msg = TransportService.validate_transport_data(transport_data, db)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    try:
        return TransportService.create_transport(db, transport_data, current_user.get("user_id"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=TransportListResponse)
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
    filter_user_id = None if current_user.get("role") == "admin" else current_user.get("user_id")

    transports, total = TransportService.list_transports(
        db, filter_user_id, status, skip, limit
    )

    return {
        "items": transports,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# Fixed paths are declared before /{transport_id} so they are not captured by it
@router.get("/efficiency", response_model=dict)
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

    Workers get their own statistics. Admins get system-wide statistics.
    """
    filter_user_id = None if current_user.get("role") == "admin" else current_user.get("user_id")
    return TransportService.get_transport_efficiency_stats(db, filter_user_id, start_date, end_date)


@router.get("/destination/{destination}", response_model=dict)
def get_transports_by_destination(
    destination: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transports to a specific destination"""
    transports = TransportService.get_transports_by_destination(db, destination)

    # Workers can only see their own transports
    if current_user.get("role") != "admin":
        user_id = current_user.get("user_id")
        transports = [t for t in transports if user_id in (t.user_id, t.driver_id)]

    return {
        "destination": destination,
        "count": len(transports),
        "transports": [TransportResponse.model_validate(t).model_dump(mode="json") for t in transports]
    }


@router.get("/{transport_id}", response_model=TransportResponse)
def get_transport(
    transport_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transport record by ID"""
    return _get_owned_transport(db, transport_id, current_user, "view")


@router.put("/{transport_id}", response_model=TransportResponse)
@router.patch("/{transport_id}", response_model=TransportResponse)
def update_transport(
    transport_id: int,
    transport_data: TransportUpdate,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Update transport record (only the fields provided are changed)"""
    transport = _get_owned_transport(db, transport_id, current_user, "update")

    # A worker who is only the assigned driver may change status and notes, nothing else
    is_admin = current_user.get("role") == "admin"
    if not is_admin and transport.user_id != current_user.get("user_id"):
        extra = set(transport_data.model_dump(exclude_unset=True)) - {"status", "notes"}
        if extra:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assigned drivers can only update status and notes"
            )

    try:
        return TransportService.update_transport(db, transport_id, transport_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{transport_id}/status", response_model=TransportResponse)
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
    _get_owned_transport(db, transport_id, current_user, "update")

    try:
        return TransportService.update_transport_status(db, transport_id, new_status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{transport_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transport(
    transport_id: int,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Delete transport record (admin only)"""
    if current_user.get("role") != "admin":
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
