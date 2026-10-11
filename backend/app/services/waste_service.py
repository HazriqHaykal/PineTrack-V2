"""
Waste Management Service
Handles business logic for waste tracking and classification
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import Waste, Harvest
from app.schemas import WasteCreate, WasteUpdate
from typing import List, Optional, Dict, Tuple


class WasteService:
    """Service for waste management operations"""

    # Valid waste types and classifications. Disposal method is free text.
    WASTE_TYPES = ["rotten", "damaged", "overripe", "unused_parts", "other"]
    CLASSIFICATIONS = ["compostable", "recyclable", "non-recyclable"]

    @staticmethod
    def create_waste(
        db: Session,
        waste_data: WasteCreate,
        user_id: int
    ) -> Waste:
        """
        Create a new waste record

        Args:
            db: Database session
            waste_data: Waste creation data
            user_id: User ID logging the waste

        Returns:
            Created Waste object
        """
        # Verify harvest exists if provided
        if waste_data.harvest_id:
            harvest = db.query(Harvest).filter(Harvest.id == waste_data.harvest_id).first()
            if not harvest:
                raise ValueError(f"Harvest {waste_data.harvest_id} not found")

        waste = Waste(
            user_id=user_id,
            harvest_id=waste_data.harvest_id,
            waste_type=waste_data.waste_type,
            quantity_kg=waste_data.quantity_kg,
            waste_date=waste_data.waste_date or date.today(),
            classification=waste_data.classification,
            disposal_method=(waste_data.disposal_method or "").strip() or None,
            notes=waste_data.notes
        )
        db.add(waste)
        db.commit()
        db.refresh(waste)
        return waste

    @staticmethod
    def get_waste_by_id(db: Session, waste_id: int) -> Optional[Waste]:
        """Get waste record by ID"""
        return db.query(Waste).filter(Waste.id == waste_id).first()

    @staticmethod
    def list_waste(
        db: Session,
        user_id: Optional[int] = None,
        waste_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Waste], int]:
        """
        List waste records with pagination and filters

        Returns:
            Tuple of (waste list, total count)
        """
        query = db.query(Waste)

        if user_id:
            query = query.filter(Waste.user_id == user_id)

        if waste_type:
            query = query.filter(Waste.waste_type == waste_type)

        total = query.count()
        waste_records = query.order_by(
            desc(Waste.waste_date), desc(Waste.id)
        ).offset(skip).limit(limit).all()

        return waste_records, total

    @staticmethod
    def update_waste(
        db: Session,
        waste_id: int,
        waste_data: WasteUpdate
    ) -> Optional[Waste]:
        """Update waste record with whichever fields were provided"""
        waste = db.query(Waste).filter(Waste.id == waste_id).first()
        if not waste:
            return None

        changes = waste_data.model_dump(exclude_unset=True)

        if changes.get("waste_type") is not None and changes["waste_type"] not in WasteService.WASTE_TYPES:
            raise ValueError(f"Invalid waste type. Must be one of: {', '.join(WasteService.WASTE_TYPES)}")

        if changes.get("classification") is not None and changes["classification"] not in WasteService.CLASSIFICATIONS:
            raise ValueError(f"Invalid classification. Must be one of: {', '.join(WasteService.CLASSIFICATIONS)}")

        if changes.get("waste_date") is not None and changes["waste_date"] > date.today():
            raise ValueError("Waste date cannot be in the future")

        if "disposal_method" in changes:
            changes["disposal_method"] = (changes["disposal_method"] or "").strip() or None

        # harvest_id may be set to null to unlink the record from its batch
        if changes.get("harvest_id") is not None:
            if not db.query(Harvest).filter(Harvest.id == changes["harvest_id"]).first():
                raise ValueError(f"Harvest {changes['harvest_id']} not found")

        # These columns are NOT NULL; ignore explicit nulls for them
        for field in ("waste_type", "quantity_kg", "waste_date", "classification"):
            if field in changes and changes[field] is None:
                del changes[field]

        for field, value in changes.items():
            setattr(waste, field, value)

        waste.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(waste)
        return waste

    @staticmethod
    def delete_waste(db: Session, waste_id: int) -> bool:
        """Delete waste record"""
        waste = db.query(Waste).filter(Waste.id == waste_id).first()
        if not waste:
            return False

        db.delete(waste)
        db.commit()
        return True

    @staticmethod
    def get_waste_statistics(
        db: Session,
        user_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Get waste statistics

        Returns:
            Dictionary with waste metrics (quantities in kg)
        """
        query = db.query(Waste)
        harvest_query = db.query(Harvest)

        if user_id:
            query = query.filter(Waste.user_id == user_id)
            harvest_query = harvest_query.filter(Harvest.user_id == user_id)

        if start_date:
            query = query.filter(Waste.waste_date >= start_date)
            harvest_query = harvest_query.filter(Harvest.harvest_date >= start_date)

        if end_date:
            query = query.filter(Waste.waste_date <= end_date)
            harvest_query = harvest_query.filter(Harvest.harvest_date <= end_date)

        waste_records = query.all()
        total_waste = sum(w.quantity_kg for w in waste_records)
        total_harvested = sum(h.quantity_kg for h in harvest_query.all())

        by_type: Dict[str, float] = {}
        by_classification: Dict[str, float] = {}
        by_disposal: Dict[str, float] = {}
        for waste in waste_records:
            by_type[waste.waste_type] = by_type.get(waste.waste_type, 0) + waste.quantity_kg
            by_classification[waste.classification] = by_classification.get(waste.classification, 0) + waste.quantity_kg
            method = waste.disposal_method or "unspecified"
            by_disposal[method] = by_disposal.get(method, 0) + waste.quantity_kg

        return {
            "total_waste_kg": round(total_waste, 2),
            "total_records": len(waste_records),
            "by_type": by_type,
            "by_classification": by_classification,
            "by_disposal_method": by_disposal,
            # Waste as a share of everything harvested in the same period
            "waste_percentage": round(total_waste / total_harvested * 100, 2) if total_harvested else 0.0,
        }

    @staticmethod
    def validate_waste_data(waste_data: WasteCreate) -> Tuple[bool, Optional[str]]:
        """Validate waste data"""
        if waste_data.quantity_kg <= 0:
            return False, "Quantity must be greater than 0"

        if waste_data.waste_type not in WasteService.WASTE_TYPES:
            return False, f"Invalid waste type. Must be one of: {', '.join(WasteService.WASTE_TYPES)}"

        if waste_data.classification not in WasteService.CLASSIFICATIONS:
            return False, f"Invalid classification. Must be one of: {', '.join(WasteService.CLASSIFICATIONS)}"

        if waste_data.waste_date and waste_data.waste_date > date.today():
            return False, "Waste date cannot be in the future"

        return True, None
