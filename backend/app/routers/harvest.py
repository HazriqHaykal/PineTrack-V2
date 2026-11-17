"""
Harvest Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker, require_admin
from app.models import Harvest, Transport, Waste
from app.schemas import (
    HarvestCreate, HarvestUpdate, HarvestResponse, HarvestListResponse,
    QualityTargetUpdate, QualityTargetResponse,
    MarketabilityPolicyUpdate, MarketabilityPolicyResponse,
    BatchDetailsResponse, BatchEventListResponse, BatchLifecycle, BatchReconciliation,
    BatchSummaryListResponse, BatchTransportsResponse, BatchWasteResponse
)
from app.services.harvest_service import HarvestService
from app.services.batch_service import BatchService, HISTORY_UNAVAILABLE
from app.services.grading_service import GradingService

router = APIRouter()


@router.post("", response_model=HarvestResponse, status_code=status.HTTP_201_CREATED)
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
    - **grades**: Optional grading breakdown in kg, e.g. {"A": 100, "B": 60, "C": 25, "D": 15}.
      Must add up to quantity_kg. Leave out for a batch that has not been graded yet.
    - **quality_grade**: Legacy single overall grade, used only when no breakdown is given
    - **notes**: Optional notes about the harvest
    
    Returns the created harvest record with ID and timestamps.
    """
    # Validate harvest data
    is_valid, error_msg = HarvestService.validate_harvest_data(harvest_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Create harvest
    user_id = current_user.get("user_id")
    try:
        return HarvestService.create_harvest(db, harvest_data, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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


@router.get("", response_model=HarvestListResponse)
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
        "items": harvests,
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
    
    # Validate quality grade if provided (a grading breakdown sets it instead)
    if harvest_data.quality_grade and harvest_data.grades is None:
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

    try:
        return HarvestService.update_harvest(db, harvest_id, harvest_data, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
    
    try:
        deleted = HarvestService.delete_harvest(db, harvest_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    
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
        "harvests": [HarvestResponse.model_validate(h).model_dump(mode="json") for h in harvests]
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


# ── Marketability policy ─────────────────────────────────────────────────────

@router.get("/policy/marketability", response_model=MarketabilityPolicyResponse)
def get_marketability_policy(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    The grades currently counted as marketable

    Workers read it for the live yield preview on the harvest form.
    """
    policy = GradingService.current_policy(db)
    db.commit()  # keeps the default version if it was just created
    return GradingService.serialize_policy(policy)


@router.get("/policy/marketability/history", response_model=List[MarketabilityPolicyResponse])
def list_marketability_policies(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Every policy version, newest first (admin only)"""
    policies = GradingService.list_policies(db)
    db.commit()
    return [GradingService.serialize_policy(p, policies[0].id) for p in policies]


@router.put("/policy/marketability", response_model=MarketabilityPolicyResponse)
def update_marketability_policy(
    data: MarketabilityPolicyUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Save a new policy version (admin only)

    Batches already graded keep the policy they were graded under; the new
    version applies to grading recorded or changed from now on.
    """
    try:
        policy = GradingService.update_policy(db, data.marketable_grades, current_user.get("user_id"), data.note)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    db.commit()
    return GradingService.serialize_policy(policy)


# ── Batch lifecycle, reconciliation and traceability ─────────────────────────

def _get_visible_batch(db: Session, harvest_id: int, current_user: dict) -> Harvest:
    """Load a batch, enforcing that workers only open batches they recorded"""
    harvest = HarvestService.get_harvest_by_id(db, harvest_id)
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Harvest batch not found")
    if current_user.get("role") != "admin" and harvest.user_id != current_user.get("user_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own harvest batches")
    return harvest


def _linked_transports(db: Session, harvest: Harvest, current_user: dict) -> dict:
    """Transports on the batch that this user may open, plus how many others exist"""
    transports = db.query(Transport).filter(Transport.harvest_id == harvest.id).order_by(
        desc(Transport.scheduled_date), desc(Transport.id)
    ).all()
    visible = transports
    if current_user.get("role") != "admin":
        user_id = current_user.get("user_id")
        visible = [t for t in transports if user_id in (t.user_id, t.driver_id)]
    return {"items": visible, "hidden_count": len(transports) - len(visible)}


def _linked_waste(db: Session, harvest: Harvest, current_user: dict) -> dict:
    """Waste records on the batch that this user may open, plus how many others exist"""
    records = db.query(Waste).filter(Waste.harvest_id == harvest.id).order_by(
        desc(Waste.waste_date), desc(Waste.id)
    ).all()
    visible = records
    if current_user.get("role") != "admin":
        visible = [w for w in records if w.user_id == current_user.get("user_id")]
    return {"items": visible, "hidden_count": len(records) - len(visible)}


@router.get("/lifecycle/overview", response_model=BatchSummaryListResponse)
def get_batch_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lifecycle status and available quantity for every batch the user can see

    Workers get their own batches. Admins get all batches.
    """
    query = db.query(Harvest)
    if current_user.get("role") != "admin":
        query = query.filter(Harvest.user_id == current_user.get("user_id"))
    return {"items": BatchService.summaries(db, query.all())}


@router.get("/{harvest_id}/details", response_model=BatchDetailsResponse)
def get_batch_details(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Everything about one batch: overview, lifecycle, quantities and linked records

    Timeline events are served separately by /{harvest_id}/events so they can be filtered.
    """
    harvest = _get_visible_batch(db, harvest_id, current_user)
    quantities = BatchService.reconciliation(db, harvest)
    complete = BatchService.history_complete(db, harvest.id)
    return {
        "batch": harvest,
        "created_by": (harvest.user.full_name or harvest.user.username) if harvest.user else None,
        "lifecycle": BatchService.lifecycle(harvest, BatchService.quantities(db, harvest)),
        "quantities": quantities,
        "grading": GradingService.grading_summary(harvest, GradingService.current_policy(db)),
        "transports": _linked_transports(db, harvest, current_user),
        "waste": _linked_waste(db, harvest, current_user),
        "history_complete": complete,
        "history_note": None if complete else HISTORY_UNAVAILABLE,
    }


@router.get("/{harvest_id}/lifecycle", response_model=BatchLifecycle)
def get_batch_lifecycle(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Operational lifecycle status, derived from the batch's transports and grading"""
    harvest = _get_visible_batch(db, harvest_id, current_user)
    return BatchService.lifecycle(harvest, BatchService.quantities(db, harvest))


@router.get("/{harvest_id}/reconciliation", response_model=BatchReconciliation)
def get_batch_reconciliation(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Harvested, lost, reserved, delivered and available quantities in kg"""
    harvest = _get_visible_batch(db, harvest_id, current_user)
    return BatchService.reconciliation(db, harvest)


@router.get("/{harvest_id}/events", response_model=BatchEventListResponse)
def get_batch_events(
    harvest_id: int,
    event_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Traceability timeline for a batch, newest first

    - **event_type**: Optional filter, e.g. transport_delivered
    """
    harvest = _get_visible_batch(db, harvest_id, current_user)
    events, total = BatchService.list_events(db, harvest.id, event_type, skip, limit)
    complete = BatchService.history_complete(db, harvest.id)
    is_admin = current_user.get("role") == "admin"
    return {
        "items": [BatchService.serialize_event(e, current_user.get("user_id"), is_admin) for e in events],
        "total": total,
        "skip": skip,
        "limit": limit,
        "event_types": BatchService.event_types(db, harvest.id),
        "history_complete": complete,
        "history_note": None if complete else HISTORY_UNAVAILABLE,
    }


@router.get("/{harvest_id}/transports", response_model=BatchTransportsResponse)
def get_batch_transports(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transports linked to the batch (workers see only those they created or drive)"""
    harvest = _get_visible_batch(db, harvest_id, current_user)
    return _linked_transports(db, harvest, current_user)


@router.get("/{harvest_id}/waste", response_model=BatchWasteResponse)
def get_batch_waste(
    harvest_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Waste records linked to the batch (workers see only their own)"""
    harvest = _get_visible_batch(db, harvest_id, current_user)
    return _linked_waste(db, harvest, current_user)
