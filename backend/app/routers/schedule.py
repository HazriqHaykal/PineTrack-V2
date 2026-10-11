"""
Schedule Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_admin, require_worker
from app.schemas import ScheduleCreate, ScheduleUpdate, ScheduleResponse, ScheduleListResponse
from app.services.schedule_service import ScheduleService

router = APIRouter()


def _serialize(schedules) -> list:
    return [ScheduleResponse.model_validate(s).model_dump(mode="json") for s in schedules]


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    schedule_data: ScheduleCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new schedule/task (admin only)

    - **worker_id**: Worker the task is assigned to
    - **task_type**: Type of task (harvest, transport, inspection, maintenance, other)
    - **assigned_date**: Date of task
    - **scheduled_time**: Optional time of task
    - **priority**: Priority level (low, medium, high)
    - **details**: Optional task details
    """
    is_valid, error_msg = ScheduleService.validate_schedule_data(schedule_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    try:
        return ScheduleService.create_schedule(db, schedule_data, current_user.get("user_id"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=ScheduleListResponse)
def list_schedules(
    task_type: str = Query(None),
    priority: str = Query(None),
    status: str = Query(None),
    assigned_date: date = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List schedule records with filtering

    - **task_type**: Filter by task type
    - **priority**: Filter by priority
    - **status**: Filter by status
    - **assigned_date**: Filter by date
    - **skip**: Pagination offset
    - **limit**: Pagination limit

    Workers see only the tasks assigned to them. Admins see all tasks.
    """
    filter_worker_id = None if current_user.get("role") == "admin" else current_user.get("user_id")

    schedules, total = ScheduleService.list_schedules(
        db, filter_worker_id, task_type, priority, status, assigned_date, skip, limit
    )

    return {
        "items": schedules,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# Fixed paths are declared before /{schedule_id} so they are not captured by it
@router.get("/worker/my-schedule", response_model=dict)
def get_my_schedule(
    assigned_date: date = Query(None),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Get the current worker's assigned tasks, optionally for a specific date"""
    user_id = current_user.get("user_id")
    schedules = ScheduleService.get_worker_schedule(db, user_id, assigned_date)

    return {
        "date": assigned_date,
        "worker_id": user_id,
        "schedules": _serialize(schedules),
        "count": len(schedules)
    }


@router.get("/worker/{worker_id}/schedule", response_model=dict)
def get_worker_schedule(
    worker_id: int,
    assigned_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get worker's schedule (admin or worker can view their own)"""
    if current_user.get("role") != "admin" and worker_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own schedule"
        )

    schedules = ScheduleService.get_worker_schedule(db, worker_id, assigned_date)

    return {
        "date": assigned_date,
        "worker_id": worker_id,
        "schedules": _serialize(schedules),
        "count": len(schedules)
    }


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get schedule record by ID"""
    schedule = ScheduleService.get_schedule_by_id(db, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )

    # Workers can only view their assigned schedules
    if current_user.get("role") != "admin" and schedule.worker_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your assigned schedules"
        )

    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
@router.patch("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update schedule record (admin only; only the fields provided are changed)"""
    try:
        updated = ScheduleService.update_schedule(db, schedule_id, schedule_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )

    return updated


@router.patch("/{schedule_id}/status", response_model=ScheduleResponse)
def update_schedule_status(
    schedule_id: int,
    new_status: str = Query(...),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Update schedule status (workers can update tasks assigned to them)

    Valid statuses: pending → in_progress → completed, cancelled
    """
    schedule = ScheduleService.get_schedule_by_id(db, schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )

    if current_user.get("role") != "admin" and schedule.worker_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your assigned schedules"
        )

    try:
        return ScheduleService.update_schedule_status(db, schedule_id, new_status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete schedule record (admin only)"""
    deleted = ScheduleService.delete_schedule(db, schedule_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )

    return None


@router.post("/{schedule_id}/assign", response_model=ScheduleResponse)
def assign_schedule(
    schedule_id: int,
    worker_id: int = Query(...),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign a schedule to a worker (admin only)"""
    try:
        updated = ScheduleService.assign_schedule(db, schedule_id, worker_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )

    return updated
