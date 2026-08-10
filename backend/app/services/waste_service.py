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
    
    # Valid waste types and disposal methods
    WASTE_TYPES = ["rotten", "damaged", "unused_parts", "other"]
    DISPOSAL_METHODS = ["compost", "recycle", "discard", "donate"]
    
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
            waste_date=waste_data.waste_date,
            disposal_method=waste_data.disposal_method,
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
        
        Args:
            db: Database session
            user_id: Optional user filter
            waste_type: Optional waste type filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Tuple of (waste list, total count)
        """
        query = db.query(Waste)
        
        if user_id:
            query = query.filter(Waste.user_id == user_id)
        
        if waste_type:
            query = query.filter(Waste.waste_type == waste_type)
        
        total = query.count()
        waste_records = query.order_by(desc(Waste.waste_date)).offset(skip).limit(limit).all()
        
        return waste_records, total
    
    @staticmethod
    def update_waste(
        db: Session,
        waste_id: int,
        waste_data: WasteUpdate
    ) -> Optional[Waste]:
        """Update waste record"""
        waste = db.query(Waste).filter(Waste.id == waste_id).first()
        if not waste:
            return None
        
        if waste_data.disposal_method is not None:
            if waste_data.disposal_method not in WasteService.DISPOSAL_METHODS:
                raise ValueError(f"Invalid disposal method. Must be one of: {', '.join(WasteService.DISPOSAL_METHODS)}")
            waste.disposal_method = waste_data.disposal_method
        
        if waste_data.notes is not None:
            waste.notes = waste_data.notes
        
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
            Dictionary with waste metrics
        """
        query = db.query(Waste)
        
        if user_id:
            query = query.filter(Waste.user_id == user_id)
        
        if start_date:
            query = query.filter(Waste.waste_date >= start_date)
        
        if end_date:
            query = query.filter(Waste.waste_date <= end_date)
        
        waste_records = query.all()
        
        if not waste_records:
            return {
                "total_waste_kg": 0.0,
                "total_records": 0,
                "by_type": {},
                "by_disposal_method": {},
                "waste_percentage": 0.0
            }
        
        total_waste = sum(w.quantity_kg for w in waste_records)
        
        by_type = {}
        for waste in waste_records:
            by_type[waste.waste_type] = by_type.get(waste.waste_type, 0) + waste.quantity_kg
        
        by_disposal = {}
        for waste in waste_records:
            by_disposal[waste.disposal_method] = by_disposal.get(waste.disposal_method, 0) + waste.quantity_kg
        
        return {
            "total_waste_kg": total_waste,
            "total_records": len(waste_records),
            "by_type": by_type,
            "by_disposal_method": by_disposal,
            "waste_percentage": round((total_waste / (total_waste + 1000)) * 100, 2)  # Rough estimate
        }
    
    @staticmethod
    def validate_waste_data(waste_data: WasteCreate) -> Tuple[bool, Optional[str]]:
        """Validate waste data"""
        if waste_data.quantity_kg <= 0:
            return False, "Quantity must be greater than 0"
        
        if waste_data.waste_type not in WasteService.WASTE_TYPES:
            return False, f"Invalid waste type. Must be one of: {', '.join(WasteService.WASTE_TYPES)}"
        
        if waste_data.disposal_method not in WasteService.DISPOSAL_METHODS:
            return False, f"Invalid disposal method. Must be one of: {', '.join(WasteService.DISPOSAL_METHODS)}"
        
        if waste_data.waste_date > date.today():
            return False, "Waste date cannot be in the future"
        
        return True, None
