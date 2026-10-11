"""
Schedule Management Service
Handles business logic for task scheduling and worker assignment
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, case
from datetime import datetime, date
from app.models import Schedule, User
from app.schemas import ScheduleCreate, ScheduleUpdate
from typing import List, Optional, Tuple


class ScheduleService:
    """Service for schedule management operations"""

    # Valid task types, priorities and statuses
    TASK_TYPES = ["harvest", "transport", "inspection", "maintenance", "other"]
    PRIORITY_LEVELS = ["low", "medium", "high"]
    STATUSES = ["pending", "in_progress", "completed", "cancelled"]

    @staticmethod
    def _require_worker(db: Session, worker_id: int) -> User:
        worker = db.query(User).filter(User.id == worker_id).first()
        if not worker:
            raise ValueError(f"Worker {worker_id} not found")
        return worker

    @staticmethod
    def create_schedule(
        db: Session,
        schedule_data: ScheduleCreate,
        user_id: int
    ) -> Schedule:
        """
        Create a new schedule/task

        Args:
            db: Database session
            schedule_data: Schedule creation data
            user_id: User ID creating the schedule (admin); used when no worker is given

        Returns:
            Created Schedule object
        """
        worker_id = schedule_data.worker_id or user_id
        ScheduleService._require_worker(db, worker_id)

        schedule = Schedule(
            worker_id=worker_id,
            task_type=schedule_data.task_type,
            assigned_date=schedule_data.assigned_date,
            scheduled_time=schedule_data.scheduled_time,
            priority=schedule_data.priority,
            status=schedule_data.status,
            details=schedule_data.details
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def get_schedule_by_id(db: Session, schedule_id: int) -> Optional[Schedule]:
        """Get schedule record by ID"""
        return db.query(Schedule).filter(Schedule.id == schedule_id).first()

    @staticmethod
    def list_schedules(
        db: Session,
        worker_id: Optional[int] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        assigned_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Schedule], int]:
        """
        List schedule records with pagination and filters

        Returns:
            Tuple of (schedules list, total count)
        """
        query = db.query(Schedule)

        if worker_id:
            query = query.filter(Schedule.worker_id == worker_id)

        if task_type:
            query = query.filter(Schedule.task_type == task_type)

        if priority:
            query = query.filter(Schedule.priority == priority)

        if status:
            query = query.filter(Schedule.status == status)

        if assigned_date:
            query = query.filter(Schedule.assigned_date == assigned_date)

        # Most urgent first, then by date
        priority_rank = case({"high": 0, "medium": 1, "low": 2}, value=Schedule.priority, else_=3)

        total = query.count()
        schedules = query.order_by(
            Schedule.assigned_date.desc(),
            priority_rank,
            Schedule.scheduled_time,
            Schedule.id
        ).offset(skip).limit(limit).all()

        return schedules, total

    @staticmethod
    def update_schedule_status(
        db: Session,
        schedule_id: int,
        new_status: str
    ) -> Optional[Schedule]:
        """Update schedule status"""
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return None

        if new_status not in ScheduleService.STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(ScheduleService.STATUSES)}")

        schedule.status = new_status
        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def update_schedule(
        db: Session,
        schedule_id: int,
        schedule_data: ScheduleUpdate
    ) -> Optional[Schedule]:
        """Update schedule record with whichever fields were provided"""
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return None

        changes = schedule_data.model_dump(exclude_unset=True)

        if changes.get("task_type") is not None and changes["task_type"] not in ScheduleService.TASK_TYPES:
            raise ValueError(f"Invalid task type. Must be one of: {', '.join(ScheduleService.TASK_TYPES)}")

        if changes.get("priority") is not None and changes["priority"] not in ScheduleService.PRIORITY_LEVELS:
            raise ValueError(f"Invalid priority. Must be one of: {', '.join(ScheduleService.PRIORITY_LEVELS)}")

        if changes.get("status") is not None and changes["status"] not in ScheduleService.STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(ScheduleService.STATUSES)}")

        if changes.get("worker_id") is not None:
            ScheduleService._require_worker(db, changes["worker_id"])

        # These columns are NOT NULL; ignore explicit nulls for them
        for field in ("task_type", "assigned_date", "priority", "status", "worker_id"):
            if field in changes and changes[field] is None:
                del changes[field]

        for field, value in changes.items():
            setattr(schedule, field, value)

        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def delete_schedule(db: Session, schedule_id: int) -> bool:
        """Delete schedule record"""
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return False

        db.delete(schedule)
        db.commit()
        return True

    @staticmethod
    def assign_schedule(
        db: Session,
        schedule_id: int,
        worker_id: int
    ) -> Optional[Schedule]:
        """Assign a schedule to a worker"""
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return None

        ScheduleService._require_worker(db, worker_id)

        schedule.worker_id = worker_id
        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def get_worker_schedule(
        db: Session,
        worker_id: int,
        assigned_date: Optional[date] = None
    ) -> List[Schedule]:
        """Get all schedules assigned to a worker, optionally for a specific date"""
        query = db.query(Schedule).filter(Schedule.worker_id == worker_id)

        if assigned_date:
            query = query.filter(Schedule.assigned_date == assigned_date)

        return query.order_by(Schedule.assigned_date, Schedule.scheduled_time, Schedule.id).all()

    @staticmethod
    def check_scheduling_conflict(
        db: Session,
        worker_id: int,
        assigned_date: date,
        exclude_schedule_id: Optional[int] = None
    ) -> bool:
        """
        Check if worker already has an active task on the given day

        Returns:
            True if conflict exists, False otherwise
        """
        query = db.query(Schedule).filter(
            and_(
                Schedule.worker_id == worker_id,
                Schedule.assigned_date == assigned_date,
                Schedule.status.notin_(["cancelled", "completed"])
            )
        )
        if exclude_schedule_id:
            query = query.filter(Schedule.id != exclude_schedule_id)

        return query.count() > 0

    @staticmethod
    def validate_schedule_data(schedule_data: ScheduleCreate) -> Tuple[bool, Optional[str]]:
        """Validate schedule data"""
        if schedule_data.task_type not in ScheduleService.TASK_TYPES:
            return False, f"Invalid task type. Must be one of: {', '.join(ScheduleService.TASK_TYPES)}"

        if schedule_data.priority not in ScheduleService.PRIORITY_LEVELS:
            return False, f"Invalid priority. Must be one of: {', '.join(ScheduleService.PRIORITY_LEVELS)}"

        if schedule_data.status not in ScheduleService.STATUSES:
            return False, f"Invalid status. Must be one of: {', '.join(ScheduleService.STATUSES)}"

        return True, None
