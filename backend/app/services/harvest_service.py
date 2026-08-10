"""
Harvest Management Service
Handles business logic for harvest operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import Harvest, User, QualityTarget
from app.schemas import HarvestCreate, HarvestUpdate, QualityTargetUpdate
from typing import List, Optional, Dict, Tuple

VALID_HARVEST_STATUSES = ["pending", "graded", "processed", "rejected"]


class HarvestService:
    """Service for harvest management operations"""

    @staticmethod
    def generate_batch_number(db: Session) -> str:
        """Generate a sequential batch number scoped to the current year, e.g. PT-2026-014"""
        year = date.today().year
        prefix = f"PT-{year}-"
        count = db.query(Harvest).filter(Harvest.batch_number.like(f"{prefix}%")).count()
        return f"{prefix}{count + 1:03d}"

    @staticmethod
    def create_harvest(
        db: Session,
        harvest_data: HarvestCreate,
        user_id: int
    ) -> Harvest:
        """
        Create a new harvest record

        Args:
            db: Database session
            harvest_data: Harvest creation data
            user_id: User ID of the worker

        Returns:
            Created Harvest object
        """
        harvest = Harvest(
            user_id=user_id,
            batch_number=HarvestService.generate_batch_number(db),
            field_name=harvest_data.field_name,
            harvest_date=harvest_data.harvest_date,
            quantity_kg=harvest_data.quantity_kg,
            quality_grade=harvest_data.quality_grade or "ungraded",
            ripeness_level=harvest_data.ripeness_level,
            harvest_status="pending",
            spoilage_kg=0,
            rejected_kg=0,
            notes=harvest_data.notes
        )
        db.add(harvest)
        db.commit()
        db.refresh(harvest)
        return harvest
    
    @staticmethod
    def get_harvest_by_id(db: Session, harvest_id: int) -> Optional[Harvest]:
        """Get harvest record by ID"""
        return db.query(Harvest).filter(Harvest.id == harvest_id).first()
    
    @staticmethod
    def list_harvests(
        db: Session, 
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> Tuple[List[Harvest], int]:
        """
        List harvest records with pagination
        
        Args:
            db: Database session
            user_id: Optional user filter (if not admin, returns only their harvests)
            skip: Pagination offset
            limit: Pagination limit
            status: Optional status filter (placeholder for future use)
            
        Returns:
            Tuple of (harvests list, total count)
        """
        query = db.query(Harvest)
        
        if user_id:
            query = query.filter(Harvest.user_id == user_id)
        
        total = query.count()
        harvests = query.order_by(desc(Harvest.harvest_date)).offset(skip).limit(limit).all()
        
        return harvests, total
    
    @staticmethod
    def update_harvest(
        db: Session, 
        harvest_id: int, 
        harvest_data: HarvestUpdate
    ) -> Optional[Harvest]:
        """
        Update harvest record
        
        Args:
            db: Database session
            harvest_id: Harvest ID to update
            harvest_data: Update data
            
        Returns:
            Updated Harvest object or None if not found
        """
        harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
        if not harvest:
            return None

        if harvest_data.quality_grade is not None:
            harvest.quality_grade = harvest_data.quality_grade

        if harvest_data.ripeness_level is not None:
            harvest.ripeness_level = harvest_data.ripeness_level

        if harvest_data.harvest_status is not None:
            harvest.harvest_status = harvest_data.harvest_status

        if harvest_data.spoilage_kg is not None:
            harvest.spoilage_kg = harvest_data.spoilage_kg

        if harvest_data.rejected_kg is not None:
            harvest.rejected_kg = harvest_data.rejected_kg

        if harvest_data.notes is not None:
            harvest.notes = harvest_data.notes

        harvest.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(harvest)
        return harvest
    
    @staticmethod
    def delete_harvest(db: Session, harvest_id: int) -> bool:
        """
        Delete harvest record
        
        Args:
            db: Database session
            harvest_id: Harvest ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
        if not harvest:
            return False
        
        db.delete(harvest)
        db.commit()
        return True
    
    @staticmethod
    def get_harvest_statistics(
        db: Session, 
        user_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Get harvest statistics for a date range
        
        Args:
            db: Database session
            user_id: Optional user filter
            start_date: Start date for statistics
            end_date: End date for statistics
            
        Returns:
            Dictionary with harvest statistics
        """
        query = db.query(Harvest)
        
        if user_id:
            query = query.filter(Harvest.user_id == user_id)
        
        if start_date:
            query = query.filter(Harvest.harvest_date >= start_date)
        
        if end_date:
            query = query.filter(Harvest.harvest_date <= end_date)
        
        harvests = query.all()

        if not harvests:
            return {
                "total_harvests": 0,
                "total_quantity_kg": 0.0,
                "average_quantity_kg": 0.0,
                "quality_grades": {},
                "total_spoilage_kg": 0.0,
                "total_rejected_kg": 0.0,
                "total_marketable_yield_kg": 0.0,
                "spoilage_rate_percent": 0.0,
                "rejection_rate_percent": 0.0,
                "marketable_yield_percent": 0.0,
            }

        total_quantity = sum(h.quantity_kg for h in harvests)
        total_spoilage = sum(h.spoilage_kg or 0 for h in harvests)
        total_rejected = sum(h.rejected_kg or 0 for h in harvests)
        total_marketable = sum(h.marketable_yield_kg for h in harvests)
        quality_counts = {}
        for h in harvests:
            grade = h.quality_grade or "ungraded"
            quality_counts[grade] = quality_counts.get(grade, 0) + 1

        return {
            "total_harvests": len(harvests),
            "total_quantity_kg": total_quantity,
            "average_quantity_kg": total_quantity / len(harvests),
            "quality_grades": quality_counts,
            "total_spoilage_kg": total_spoilage,
            "total_rejected_kg": total_rejected,
            "total_marketable_yield_kg": total_marketable,
            "spoilage_rate_percent": round((total_spoilage / total_quantity) * 100, 2) if total_quantity else 0.0,
            "rejection_rate_percent": round((total_rejected / total_quantity) * 100, 2) if total_quantity else 0.0,
            "marketable_yield_percent": round((total_marketable / total_quantity) * 100, 2) if total_quantity else 0.0,
        }
    
    @staticmethod
    def get_harvests_by_field(
        db: Session, 
        field_name: str
    ) -> List[Harvest]:
        """Get all harvests from a specific field"""
        return db.query(Harvest).filter(
            Harvest.field_name == field_name
        ).order_by(desc(Harvest.harvest_date)).all()
    
    @staticmethod
    def validate_harvest_data(harvest_data: HarvestCreate) -> Tuple[bool, Optional[str]]:
        """
        Validate harvest data
        
        Args:
            harvest_data: Harvest data to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if harvest_data.quantity_kg <= 0:
            return False, "Quantity must be greater than 0"
        
        if not harvest_data.field_name.strip():
            return False, "Field name cannot be empty"
        
        if harvest_data.harvest_date > date.today():
            return False, "Harvest date cannot be in the future"
        
        valid_grades = ["A", "B", "C", "D", "ungraded"]
        if harvest_data.quality_grade and harvest_data.quality_grade not in valid_grades:
            return False, f"Quality grade must be one of: {', '.join(valid_grades)}"

        return True, None

    @staticmethod
    def validate_harvest_update(
        harvest_data: HarvestUpdate,
        harvest: Harvest
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate harvest update data against the existing record

        Args:
            harvest_data: Update data
            harvest: Existing Harvest record being updated

        Returns:
            Tuple of (is_valid, error_message)
        """
        if harvest_data.harvest_status and harvest_data.harvest_status not in VALID_HARVEST_STATUSES:
            return False, f"Harvest status must be one of: {', '.join(VALID_HARVEST_STATUSES)}"

        spoilage = harvest_data.spoilage_kg if harvest_data.spoilage_kg is not None else harvest.spoilage_kg
        rejected = harvest_data.rejected_kg if harvest_data.rejected_kg is not None else harvest.rejected_kg
        if (spoilage or 0) + (rejected or 0) > harvest.quantity_kg:
            return False, "Spoilage and rejected quantities cannot exceed the total harvested quantity"

        return True, None

    @staticmethod
    def get_quality_targets(db: Session) -> QualityTarget:
        """Get the current quality targets, creating the default row if none exists"""
        target = db.query(QualityTarget).first()
        if not target:
            target = QualityTarget(max_spoilage_rate=5.0, max_rejection_rate=5.0)
            db.add(target)
            db.commit()
            db.refresh(target)
        return target

    @staticmethod
    def update_quality_targets(db: Session, data: QualityTargetUpdate) -> QualityTarget:
        """Update (or create) the management-defined quality targets"""
        target = db.query(QualityTarget).first()
        if not target:
            target = QualityTarget()
            db.add(target)

        target.max_spoilage_rate = data.max_spoilage_rate
        target.max_rejection_rate = data.max_rejection_rate
        db.commit()
        db.refresh(target)
        return target
