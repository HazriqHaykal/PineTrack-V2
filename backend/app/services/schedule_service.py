"""
Schedule Management Service
Handles business logic for task scheduling and worker assignment
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from datetime import datetime, date, time
from app.models import Schedule, User
from app.schemas import ScheduleCreate, ScheduleUpdate
from typing import List, Optional, Dict, Tuple


class ScheduleService:
    """Service for schedule management operations"""
    
    # Valid task types and priorities
    TASK_TYPES = ["harvest", "transport", "maintenance", "inspection"]
    PRIORITY_LEVELS = ["low", "normal", "high", "urgent"]
    STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled"]
    
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
            user_id: User ID creating the schedule (admin)
            
        Returns:
            Created Schedule object
        """
        schedule = Schedule(
            user_id=user_id,
            task_type=schedule_data.task_type,
            scheduled_date=schedule_data.scheduled_date,
            scheduled_time=schedule_data.scheduled_time,
            priority=schedule_data.priority,
            status="pending",
            notes=schedule_data.notes
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
        user_id: Optional[int] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        scheduled_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Schedule], int]:
        """
        List schedule records with pagination and filters
        
        Args:
            db: Database session
            user_id: Optional worker/user filter
            task_type: Optional task type filter
            priority: Optional priority filter
            status: Optional status filter
            scheduled_date: Optional date filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Tuple of (schedules list, total count)
        """
        query = db.query(Schedule)
        
        if user_id:
            query = query.filter(Schedule.user_id == user_id)
        
        if task_type:
            query = query.filter(Schedule.task_type == task_type)
        
        if priority:
            query = query.filter(Schedule.priority == priority)
        
        if status:
            query = query.filter(Schedule.status == status)
        
        if scheduled_date:
            query = query.filter(Schedule.scheduled_date == scheduled_date)
        
        total = query.count()
        schedules = query.order_by(
            Schedule.priority,
            Schedule.scheduled_date,
            Schedule.scheduled_time
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
        """Update schedule record"""
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return None
        
        if schedule_data.priority is not None:
            if schedule_data.priority not in ScheduleService.PRIORITY_LEVELS:
                raise ValueError(f"Invalid priority. Must be one of: {', '.join(ScheduleService.PRIORITY_LEVELS)}")
            schedule.priority = schedule_data.priority
        
        if schedule_data.status is not None:
            if schedule_data.status not in ScheduleService.STATUSES:
                raise ValueError(f"Invalid status. Must be one of: {', '.join(ScheduleService.STATUSES)}")
            schedule.status = schedule_data.status
        
        if schedule_data.notes is not None:
            schedule.notes = schedule_data.notes
        
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
        
        # Verify worker exists
        worker = db.query(User).filter(User.id == worker_id).first()
        if not worker:
            raise ValueError(f"Worker {worker_id} not found")
        
        schedule.user_id = worker_id
        schedule.status = "assigned"
        schedule.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(schedule)
        return schedule
    
    @staticmethod
    def get_worker_schedule(
        db: Session,
        worker_id: int,
        scheduled_date: Optional[date] = None
    ) -> List[Schedule]:
        """Get all schedules assigned to a worker for a specific date"""
        query = db.query(Schedule).filter(Schedule.user_id == worker_id)
        
        if scheduled_date:
            query = query.filter(Schedule.scheduled_date == scheduled_date)
        
        return query.order_by(Schedule.scheduled_time).all()
    
    @staticmethod
    def check_scheduling_conflict(
        db: Session,
        worker_id: int,
        scheduled_date: date,
        scheduled_time: time,
        duration_hours: float = 2.0
    ) -> bool:
        """
        Check if worker has scheduling conflict
        
        Returns:
            True if conflict exists, False otherwise
        """
        schedules = db.query(Schedule).filter(
            and_(
                Schedule.user_id == worker_id,
                Schedule.scheduled_date == scheduled_date,
                Schedule.status != "cancelled"
            )
        ).all()
        
        # Simple check - if any task on same day, consider it a conflict
        # In production, would need more sophisticated time-based checking
        return len(schedules) > 0
    
    @staticmethod
    def validate_schedule_data(schedule_data: ScheduleCreate) -> Tuple[bool, Optional[str]]:
        """Validate schedule data"""
        if schedule_data.task_type not in ScheduleService.TASK_TYPES:
            return False, f"Invalid task type. Must be one of: {', '.join(ScheduleService.TASK_TYPES)}"
        
        if schedule_data.priority not in ScheduleService.PRIORITY_LEVELS:
            return False, f"Invalid priority. Must be one of: {', '.join(ScheduleService.PRIORITY_LEVELS)}"
        
        if schedule_data.scheduled_date < date.today():
            return False, "Scheduled date cannot be in the past"
        
        return True, None
