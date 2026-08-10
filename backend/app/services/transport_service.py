"""
Transport Management Service
Handles business logic for transport operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import Transport, Harvest
from app.schemas import TransportCreate, TransportUpdate
from typing import List, Optional, Dict, Tuple


class TransportService:
    """Service for transport management operations"""
    
    @staticmethod
    def create_transport(
        db: Session,
        transport_data: TransportCreate,
        user_id: int
    ) -> Transport:
        """
        Create a new transport record
        
        Args:
            db: Database session
            transport_data: Transport creation data
            user_id: User ID of the driver/operator
            
        Returns:
            Created Transport object
        """
        # Verify harvest exists
        harvest = db.query(Harvest).filter(Harvest.id == transport_data.harvest_id).first()
        if not harvest:
            raise ValueError(f"Harvest {transport_data.harvest_id} not found")
        
        transport = Transport(
            user_id=user_id,
            harvest_id=transport_data.harvest_id,
            destination=transport_data.destination,
            transport_date=transport_data.transport_date,
            vehicle_id=transport_data.vehicle_id,
            quantity_kg=transport_data.quantity_kg,
            status="pending",
            notes=transport_data.notes
        )
        db.add(transport)
        db.commit()
        db.refresh(transport)
        return transport
    
    @staticmethod
    def get_transport_by_id(db: Session, transport_id: int) -> Optional[Transport]:
        """Get transport record by ID"""
        return db.query(Transport).filter(Transport.id == transport_id).first()
    
    @staticmethod
    def list_transports(
        db: Session,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Transport], int]:
        """
        List transport records with pagination and filters
        
        Args:
            db: Database session
            user_id: Optional user filter (driver)
            status: Optional status filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Tuple of (transports list, total count)
        """
        query = db.query(Transport)
        
        if user_id:
            query = query.filter(Transport.user_id == user_id)
        
        if status:
            query = query.filter(Transport.status == status)
        
        total = query.count()
        transports = query.order_by(desc(Transport.transport_date)).offset(skip).limit(limit).all()
        
        return transports, total
    
    @staticmethod
    def update_transport_status(
        db: Session,
        transport_id: int,
        new_status: str
    ) -> Optional[Transport]:
        """
        Update transport status
        
        Valid statuses: pending → in_transit → delivered
        """
        transport = db.query(Transport).filter(Transport.id == transport_id).first()
        if not transport:
            return None
        
        valid_statuses = ["pending", "in_transit", "delivered", "cancelled"]
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        transport.status = new_status
        transport.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(transport)
        return transport
    
    @staticmethod
    def update_transport(
        db: Session,
        transport_id: int,
        transport_data: TransportUpdate
    ) -> Optional[Transport]:
        """Update transport record"""
        transport = db.query(Transport).filter(Transport.id == transport_id).first()
        if not transport:
            return None
        
        if transport_data.status is not None:
            valid_statuses = ["pending", "in_transit", "delivered", "cancelled"]
            if transport_data.status not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
            transport.status = transport_data.status
        
        if transport_data.notes is not None:
            transport.notes = transport_data.notes
        
        transport.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(transport)
        return transport
    
    @staticmethod
    def delete_transport(db: Session, transport_id: int) -> bool:
        """Delete transport record"""
        transport = db.query(Transport).filter(Transport.id == transport_id).first()
        if not transport:
            return False
        
        db.delete(transport)
        db.commit()
        return True
    
    @staticmethod
    def get_transport_efficiency_stats(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Get transport efficiency statistics
        
        Returns:
            Dictionary with efficiency metrics
        """
        query = db.query(Transport)
        
        if start_date:
            query = query.filter(Transport.transport_date >= start_date)
        
        if end_date:
            query = query.filter(Transport.transport_date <= end_date)
        
        transports = query.all()
        
        if not transports:
            return {
                "total_transports": 0,
                "total_quantity_kg": 0.0,
                "delivered_count": 0,
                "pending_count": 0,
                "in_transit_count": 0,
                "delivery_rate": 0.0
            }
        
        delivered = [t for t in transports if t.status == "delivered"]
        in_transit = [t for t in transports if t.status == "in_transit"]
        pending = [t for t in transports if t.status == "pending"]
        
        total_quantity = sum(t.quantity_kg for t in transports)
        delivery_rate = (len(delivered) / len(transports) * 100) if transports else 0
        
        return {
            "total_transports": len(transports),
            "total_quantity_kg": total_quantity,
            "delivered_count": len(delivered),
            "in_transit_count": len(in_transit),
            "pending_count": len(pending),
            "delivery_rate_percent": round(delivery_rate, 2)
        }
    
    @staticmethod
    def get_transports_by_destination(
        db: Session,
        destination: str
    ) -> List[Transport]:
        """Get all transports to a specific destination"""
        return db.query(Transport).filter(
            Transport.destination == destination
        ).order_by(desc(Transport.transport_date)).all()
    
    @staticmethod
    def validate_transport_data(
        transport_data: TransportCreate,
        db: Session
    ) -> Tuple[bool, Optional[str]]:
        """Validate transport data"""
        if transport_data.quantity_kg <= 0:
            return False, "Quantity must be greater than 0"
        
        if not transport_data.destination.strip():
            return False, "Destination cannot be empty"
        
        if transport_data.transport_date > date.today():
            return False, "Transport date cannot be in the future"
        
        # Verify harvest exists and has enough quantity
        harvest = db.query(Harvest).filter(Harvest.id == transport_data.harvest_id).first()
        if not harvest:
            return False, f"Harvest {transport_data.harvest_id} not found"
        
        if transport_data.quantity_kg > harvest.quantity_kg:
            return False, f"Transport quantity ({transport_data.quantity_kg}) exceeds harvest quantity ({harvest.quantity_kg})"
        
        return True, None
