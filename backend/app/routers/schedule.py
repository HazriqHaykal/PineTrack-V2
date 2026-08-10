"""
Schedule Management API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from app.config import get_db
from app.middleware.rbac import get_current_user, require_admin, require_worker
from app.schemas import ScheduleCreate, ScheduleUpdate
from app.services.schedule_service import ScheduleService

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_schedule(
    schedule_data: ScheduleCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new schedule/task (admin only)
    
    - **task_type**: Type of task (harvest, transport, maintenance, inspection)
    - **scheduled_date**: Date of task
    - **scheduled_time**: Time of task
    - **priority**: Priority level (low, normal, high, urgent)
    - **notes**: Optional notes
    """
    # Validate schedule data
    is_valid, error_msg = ScheduleService.validate_schedule_data(schedule_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    user_id = current_user.get("user_id")
    schedule = ScheduleService.create_schedule(db, schedule_data, user_id)
    
    return schedule


@router.get("/{schedule_id}")
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
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and schedule.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your assigned schedules"
        )
    
    return schedule


@router.get("/", response_model=dict)
def list_schedules(
    task_type: str = Query(None),
    priority: str = Query(None),
    status: str = Query(None),
    scheduled_date: date = Query(None),
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
    - **scheduled_date**: Filter by date
    - **skip**: Pagination offset
    - **limit**: Pagination limit
    """
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    filter_user_id = None if user_role == "admin" else user_id
    
    schedules, total = ScheduleService.list_schedules(
        db, filter_user_id, task_type, priority, status, scheduled_date, skip, limit
    )
    
    return {
        "items": schedules,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.patch("/{schedule_id}")
def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update schedule record (admin only)"""
    schedule = ScheduleService.get_schedule_by_id(db, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    try:
        updated = ScheduleService.update_schedule(db, schedule_id, schedule_data)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{schedule_id}/status")
def update_schedule_status(
    schedule_id: int,
    new_status: str = Query(...),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Update schedule status
    
    Valid statuses: pending → assigned → in_progress → completed, cancelled
    """
    schedule = ScheduleService.get_schedule_by_id(db, schedule_id)
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Authorization check
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and schedule.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your assigned schedules"
        )
    
    try:
        updated = ScheduleService.update_schedule_status(db, schedule_id, new_status)
        return updated
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


@router.post("/{schedule_id}/assign")
def assign_schedule(
    schedule_id: int,
    worker_id: int = Query(...),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign a schedule to a worker (admin only)"""
    try:
        updated = ScheduleService.assign_schedule(db, schedule_id, worker_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found"
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/worker/my-schedule", response_model=dict)
def get_my_schedule(
    scheduled_date: date = Query(None),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """Get worker's assigned schedule for a specific date"""
    user_id = current_user.get("user_id")
    schedules = ScheduleService.get_worker_schedule(db, user_id, scheduled_date)
    
    return {
        "date": scheduled_date,
        "worker_id": user_id,
        "schedules": schedules,
        "count": len(schedules)
    }


@router.get("/worker/{worker_id}/schedule", response_model=dict)
def get_worker_schedule(
    worker_id: int,
    scheduled_date: date = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get worker's schedule (admin or worker can view their own)"""
    user_id = current_user.get("user_id")
    user_role = current_user.get("role")
    
    if user_role != "admin" and worker_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own schedule"
        )
    
    schedules = ScheduleService.get_worker_schedule(db, worker_id, scheduled_date)
    
    return {
        "date": scheduled_date,
        "worker_id": worker_id,
        "schedules": schedules,
        "count": len(schedules)
    }
