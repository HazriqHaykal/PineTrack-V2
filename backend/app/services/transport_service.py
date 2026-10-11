"""
Transport Management Service
Handles business logic for transport operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import Transport, Harvest, User
from sqlalchemy import or_
from app.schemas import TransportCreate, TransportUpdate
from typing import List, Optional, Dict, Tuple

VALID_TRANSPORT_STATUSES = ["pending", "in_transit", "delivered", "cancelled"]


class TransportService:
    """Service for transport management operations"""

    @staticmethod
    def _apply_status(transport: Transport, new_status: str) -> None:
        """Set status, stamping the delivery date the first time it is delivered"""
        if new_status not in VALID_TRANSPORT_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(VALID_TRANSPORT_STATUSES)}")
        transport.status = new_status
        if new_status == "delivered":
            if not transport.actual_delivery:
                transport.actual_delivery = date.today()
        else:
            transport.actual_delivery = None

    @staticmethod
    def _driver_name(db: Session, driver_id: Optional[int], driver_name: Optional[str]) -> str:
        """Use the typed name, or the assigned worker's name when none was typed"""
        name = (driver_name or "").strip()
        if not name and driver_id:
            driver = db.query(User).filter(User.id == driver_id).first()
            if driver:
                name = driver.full_name or driver.username
        return name

    @staticmethod
    def visible_to(query, user_id: int):
        """Restrict a Transport query to records a worker created or is assigned to drive"""
        return query.filter(or_(Transport.user_id == user_id, Transport.driver_id == user_id))

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
            user_id: User ID of the operator creating the record

        Returns:
            Created Transport object
        """
        transport = Transport(
            user_id=user_id,
            harvest_id=transport_data.harvest_id,
            driver_id=transport_data.driver_id,
            destination=transport_data.destination.strip(),
            driver_name=TransportService._driver_name(db, transport_data.driver_id, transport_data.driver_name),
            vehicle_number=transport_data.vehicle_number.strip(),
            scheduled_date=transport_data.scheduled_date,
            cargo_weight_kg=transport_data.cargo_weight_kg,
            notes=transport_data.notes
        )
        TransportService._apply_status(transport, transport_data.status)
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

        Returns:
            Tuple of (transports list, total count)
        """
        query = db.query(Transport)

        if user_id:
            query = TransportService.visible_to(query, user_id)

        if status:
            query = query.filter(Transport.status == status)

        total = query.count()
        transports = query.order_by(
            desc(Transport.scheduled_date), desc(Transport.id)
        ).offset(skip).limit(limit).all()

        return transports, total

    @staticmethod
    def update_transport_status(
        db: Session,
        transport_id: int,
        new_status: str
    ) -> Optional[Transport]:
        """
        Update transport status

        Valid statuses: pending → in_transit → delivered, cancelled
        """
        transport = db.query(Transport).filter(Transport.id == transport_id).first()
        if not transport:
            return None

        TransportService._apply_status(transport, new_status)
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
        """Update transport record with whichever fields were provided"""
        transport = db.query(Transport).filter(Transport.id == transport_id).first()
        if not transport:
            return None

        changes = transport_data.model_dump(exclude_unset=True)
        new_status = changes.pop("status", None)

        if changes.get("harvest_id") is not None:
            if not db.query(Harvest).filter(Harvest.id == changes["harvest_id"]).first():
                raise ValueError(f"Harvest {changes['harvest_id']} not found")

        if changes.get("driver_id") is not None:
            if not db.query(User).filter(User.id == changes["driver_id"]).first():
                raise ValueError(f"Worker {changes['driver_id']} not found")

        for field in ("destination", "driver_name", "vehicle_number"):
            if changes.get(field) is not None:
                changes[field] = changes[field].strip()
        if "destination" in changes and not changes["destination"]:
            raise ValueError("Destination cannot be empty")

        # These columns are NOT NULL; ignore explicit nulls for them
        for field in ("destination", "driver_name", "vehicle_number", "scheduled_date"):
            if field in changes and changes[field] is None:
                del changes[field]

        for field, value in changes.items():
            setattr(transport, field, value)

        if new_status is not None:
            TransportService._apply_status(transport, new_status)

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
        user_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Get transport efficiency statistics

        Returns:
            Dictionary with efficiency metrics
        """
        query = db.query(Transport)

        if user_id:
            query = TransportService.visible_to(query, user_id)

        if start_date:
            query = query.filter(Transport.scheduled_date >= start_date)

        if end_date:
            query = query.filter(Transport.scheduled_date <= end_date)

        transports = query.all()

        delivered = [t for t in transports if t.status == "delivered"]
        in_transit = [t for t in transports if t.status == "in_transit"]
        pending = [t for t in transports if t.status == "pending"]
        cancelled = [t for t in transports if t.status == "cancelled"]

        # Days between the planned date and the actual delivery
        delays = [
            (t.actual_delivery - t.scheduled_date).days
            for t in delivered if t.actual_delivery
        ]
        on_time = [d for d in delays if d <= 0]

        return {
            "total_transports": len(transports),
            "total_cargo_weight_kg": round(sum(t.cargo_weight_kg or 0 for t in transports), 2),
            "delivered": len(delivered),
            "in_transit": len(in_transit),
            "pending": len(pending),
            "cancelled": len(cancelled),
            "delivery_rate_percent": round(len(delivered) / len(transports) * 100, 2) if transports else 0.0,
            "on_time_rate_percent": round(len(on_time) / len(delays) * 100, 2) if delays else 0.0,
            "avg_delivery_days": round(sum(max(d, 0) for d in delays) / len(delays), 2) if delays else 0.0,
        }

    @staticmethod
    def get_transports_by_destination(
        db: Session,
        destination: str
    ) -> List[Transport]:
        """Get all transports to a specific destination"""
        return db.query(Transport).filter(
            Transport.destination == destination
        ).order_by(desc(Transport.scheduled_date)).all()

    @staticmethod
    def validate_transport_data(
        transport_data: TransportCreate,
        db: Session
    ) -> Tuple[bool, Optional[str]]:
        """Validate transport data"""
        if not transport_data.destination.strip():
            return False, "Destination cannot be empty"

        if transport_data.status not in VALID_TRANSPORT_STATUSES:
            return False, f"Invalid status. Must be one of: {', '.join(VALID_TRANSPORT_STATUSES)}"

        if transport_data.driver_id is not None:
            if not db.query(User).filter(User.id == transport_data.driver_id).first():
                return False, f"Worker {transport_data.driver_id} not found"

        if transport_data.harvest_id is not None:
            harvest = db.query(Harvest).filter(Harvest.id == transport_data.harvest_id).first()
            if not harvest:
                return False, f"Harvest {transport_data.harvest_id} not found"

            if transport_data.cargo_weight_kg and transport_data.cargo_weight_kg > harvest.quantity_kg:
                return False, (
                    f"Cargo weight ({transport_data.cargo_weight_kg}) exceeds "
                    f"harvest quantity ({harvest.quantity_kg})"
                )

        return True, None
