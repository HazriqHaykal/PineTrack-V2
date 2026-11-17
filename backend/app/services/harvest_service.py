"""
Harvest Management Service
Handles business logic for harvest operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import Harvest, User, QualityTarget, Transport, Waste
from app.schemas import HarvestCreate, HarvestUpdate, QualityTargetUpdate
from typing import List, Optional, Dict, Tuple
from app.services.batch_service import BatchService
from app.services.grading_service import SORTED_OUT_WASTE_TYPES, GradingService
from app.services.yield_calc import compute_yield, farm_yield, kg

VALID_HARVEST_STATUSES = ["pending", "graded", "processed", "rejected"]


class HarvestService:
    """Service for harvest management operations"""

    @staticmethod
    def generate_batch_number(db: Session) -> str:
        """Generate a sequential batch number scoped to the current year, e.g. PT-2026-014"""
        year = date.today().year
        prefix = f"PT-{year}-"
        existing = db.query(Harvest.batch_number).filter(Harvest.batch_number.like(f"{prefix}%")).all()
        # Continue from the highest number used so deleted batches never cause a duplicate
        numbers = [int(b[len(prefix):]) for (b,) in existing if b[len(prefix):].isdigit()]
        return f"{prefix}{max(numbers, default=0) + 1:03d}"

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

        Raises:
            ValueError: the grading breakdown does not reconcile with the harvested quantity
        """
        quantities = None
        sorted_out = kg(harvest_data.non_marketable_kg or 0)
        reason = HarvestService._sorted_out_reason(harvest_data.non_marketable_reason)
        if harvest_data.grades is not None:
            quantities = GradingService.validate_breakdown(
                harvest_data.quantity_kg, harvest_data.grades, harvest_data.non_marketable_kg
            )
        elif sorted_out > 0:
            raise ValueError("Record the grade quantities together with the non-marketable quantity")

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
            rejected_kg=float(sorted_out),  # non-marketable fruit sorted out at harvest
            notes=harvest_data.notes
        )
        if quantities is not None:
            GradingService.apply_breakdown(harvest, quantities, GradingService.current_policy(db))
        db.add(harvest)
        db.flush()  # assigns the id the creation event refers to
        BatchService.log_harvest_created(db, harvest, user_id)
        if quantities is not None:
            BatchService.log_grading(db, None, harvest, user_id)
        if sorted_out > 0:
            HarvestService._log_sorted_out_waste(db, harvest, sorted_out, reason, user_id)
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
        harvest_data: HarvestUpdate,
        actor_id: Optional[int] = None
    ) -> Optional[Harvest]:
        """
        Update harvest record
        
        Args:
            db: Database session
            harvest_id: Harvest ID to update
            harvest_data: Update data
            actor_id: User making the change, recorded on the batch timeline
            
        Returns:
            Updated Harvest object or None if not found

        Raises:
            ValueError: the change would leave transport commitments without stock
        """
        # Locked so a transport cannot be allocated against the old quantities meanwhile
        harvest = BatchService.lock_batch(db, harvest_id)
        if not harvest:
            return None

        quantities = policy = grade_rows = None
        rejected = harvest_data.rejected_kg
        old_sorted_out = kg(harvest.rejected_at_sorting_kg or 0)
        new_sorted_out = old_sorted_out
        reason = HarvestService._sorted_out_reason(harvest_data.non_marketable_reason)
        if harvest_data.grades is not None:
            quantities = GradingService.validate_breakdown(
                harvest.quantity_kg, harvest_data.grades, harvest_data.non_marketable_kg
            )
            policy = GradingService.current_policy(db)
            grade_rows = GradingService.proposed_rows(quantities, policy)
            new_sorted_out = kg(harvest_data.non_marketable_kg or 0)
            if rejected is None:
                if harvest.grading_basis == "grade_based":
                    # Keep any rejection recorded after grading on top of the new sorting figure
                    rejected = float(new_sorted_out + kg(harvest.rejected_after_grading_kg or 0))
                else:
                    # A rejection entered before grading is taken to be the same fruit as the sorted-out kg
                    rejected = float(max(kg(harvest.rejected_kg), new_sorted_out))
        elif harvest_data.non_marketable_kg is not None:
            raise ValueError("Send the grade quantities together with the non-marketable quantity")

        HarvestService._check_grade_based_update(harvest, harvest_data, grade_rows, rejected)
        BatchService.check_harvest_change(
            db, harvest, harvest_data.spoilage_kg, rejected, harvest_data.harvest_status, grade_rows
        )
        before = BatchService.harvest_snapshot(harvest)

        if quantities is not None:
            GradingService.apply_breakdown(harvest, quantities, policy)
        elif harvest_data.quality_grade is not None:
            harvest.quality_grade = harvest_data.quality_grade

        if harvest_data.ripeness_level is not None:
            harvest.ripeness_level = harvest_data.ripeness_level

        if harvest_data.harvest_status is not None:
            harvest.harvest_status = harvest_data.harvest_status

        if harvest_data.spoilage_kg is not None:
            harvest.spoilage_kg = harvest_data.spoilage_kg

        if rejected is not None:
            harvest.rejected_kg = rejected

        # Newly sorted-out fruit is logged in Waste Management; a reduction leaves
        # existing waste records alone (the batch page flags the difference)
        if new_sorted_out > old_sorted_out:
            HarvestService._log_sorted_out_waste(db, harvest, new_sorted_out - old_sorted_out, reason, actor_id)

        if harvest_data.notes is not None:
            harvest.notes = harvest_data.notes

        BatchService.log_harvest_changes(db, before, harvest, actor_id)
        harvest.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(harvest)
        return harvest
    
    @staticmethod
    def _sorted_out_reason(reason: Optional[str]) -> str:
        value = (reason or "damaged").strip().lower()
        if value not in SORTED_OUT_WASTE_TYPES:
            raise ValueError(f"Non-marketable reason must be one of: {', '.join(SORTED_OUT_WASTE_TYPES)}")
        return value

    @staticmethod
    def _log_sorted_out_waste(db: Session, harvest: Harvest, amount, reason: str, user_id: Optional[int]) -> None:
        waste = GradingService.sorted_out_waste(harvest, amount, reason, user_id or harvest.user_id)
        db.add(waste)
        db.flush()
        BatchService.log_waste_change(db, None, waste, user_id)

    @staticmethod
    def _check_grade_based_update(harvest: Harvest, data: HarvestUpdate, grade_rows, rejected_kg) -> None:
        """
        Rules for a batch that has (or is getting) a grading breakdown:
          - the overall grade comes from the breakdown and cannot be set separately
          - rejection includes the non-marketable kg sorted out at harvest
          - spoilage and rejection after grading come out of the marketable
            grades, so together they cannot exceed them

        rejected_kg: the batch's proposed total rejection (None = unchanged)

        Raises:
            ValueError: with a message suitable for the user
        """
        rows = grade_rows if grade_rows is not None else (
            [(g.grade, g.quantity_kg, g.is_marketable) for g in harvest.grades]
            if harvest.grading_basis == "grade_based" else None
        )
        if rows is None:
            return

        if data.quality_grade is not None and grade_rows is None and data.quality_grade != harvest.quality_grade:
            raise ValueError(
                "This batch has a grading breakdown; change the grade quantities instead of the overall grade"
            )
        spoilage = kg(data.spoilage_kg if data.spoilage_kg is not None else harvest.spoilage_kg)
        rejected = kg(rejected_kg if rejected_kg is not None else harvest.rejected_kg)
        sorted_out = kg(harvest.quantity_kg) - sum((kg(q) for _, q, _ in rows), kg(0))
        if rejected < sorted_out:
            raise ValueError(
                f"Rejected ({float(rejected):g} kg) cannot be less than the {float(sorted_out):g} kg "
                f"non-marketable recorded at sorting"
            )
        y = compute_yield(harvest.quantity_kg, spoilage, rejected, rows)
        after = rejected - sorted_out
        if spoilage + after > y["graded_marketable"]:
            raise ValueError(
                f"Spoilage and rejection after grading ({float(spoilage + after):g} kg) cannot exceed the "
                f"marketable graded quantity ({float(y['graded_marketable']):g} kg)"
            )

    @staticmethod
    def delete_harvest(db: Session, harvest_id: int) -> bool:
        """
        Delete harvest record
        
        Args:
            db: Database session
            harvest_id: Harvest ID to delete
            
        Returns:
            True if deleted, False if not found

        Raises:
            ValueError: transports or waste records are still linked to the batch
        """
        harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
        if not harvest:
            return False

        # Linked records would be left pointing at a missing batch
        transports = db.query(Transport.id).filter(Transport.harvest_id == harvest_id).count()
        waste = db.query(Waste.id).filter(Waste.harvest_id == harvest_id).count()
        if transports or waste:
            raise ValueError(
                f"Batch {harvest.batch_number} has {transports} transport and {waste} waste record(s) "
                "linked to it. Remove or relink them before deleting the batch"
            )

        # Its timeline events are removed with it
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
                "by_grade": {},
                "this_month": 0,
                "total_spoilage_kg": 0.0,
                "total_rejected_kg": 0.0,
                "total_marketable_yield_kg": 0.0,
                "spoilage_rate_percent": 0.0,
                "rejection_rate_percent": 0.0,
                "marketable_yield_percent": 0.0,
                "grading": farm_yield([]),
            }

        today = date.today()
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
            "by_grade": quality_counts,
            "this_month": sum(
                1 for h in harvests
                if h.harvest_date.year == today.year and h.harvest_date.month == today.month
            ),
            "total_spoilage_kg": total_spoilage,
            "total_rejected_kg": total_rejected,
            "total_marketable_yield_kg": total_marketable,
            "spoilage_rate_percent": round((total_spoilage / total_quantity) * 100, 2) if total_quantity else 0.0,
            "rejection_rate_percent": round((total_rejected / total_quantity) * 100, 2) if total_quantity else 0.0,
            "marketable_yield_percent": round((total_marketable / total_quantity) * 100, 2) if total_quantity else 0.0,
            # Quantity-weighted yield over grade-based batches only; legacy and ungraded batches are counted apart
            "grading": farm_yield([h.yield_breakdown for h in harvests]),
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

        # Grade-based batches are checked against their breakdown in update_harvest
        if harvest_data.grades is not None or harvest.grading_basis == "grade_based":
            return True, None

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
