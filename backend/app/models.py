"""
SQLAlchemy ORM Models for PineTrack V2.0
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from .config import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(String(20), default="worker")  # admin, worker, user
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    harvests = relationship("Harvest", back_populates="user")
    transports = relationship("Transport", back_populates="user", foreign_keys="Transport.user_id")
    schedules = relationship("Schedule", back_populates="user")
    waste_records = relationship("Waste", back_populates="user")
    ai_logs = relationship("AILog", back_populates="user")


class Harvest(Base):
    __tablename__ = "harvest"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    field_name = Column(String(100), nullable=False)
    harvest_date = Column(Date, nullable=False)
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(String(20), nullable=True)  # A, B, C, etc.
    ripeness_level = Column(Float, nullable=True)  # 0-10 scale
    harvest_status = Column(String(20), nullable=False, default="pending")  # pending, graded, processed, rejected
    spoilage_kg = Column(Float, nullable=False, default=0)
    rejected_kg = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="harvests")
    transports = relationship("Transport", back_populates="harvest")
    waste_records = relationship("Waste", back_populates="harvest")
    ai_logs = relationship("AILog", back_populates="harvest")

    @property
    def worker_id(self) -> int:
        return self.user_id

    @property
    def marketable_yield_kg(self) -> float:
        """Quantity left after removing spoiled and rejected pineapples."""
        return max(self.quantity_kg - (self.spoilage_kg or 0) - (self.rejected_kg or 0), 0.0)

    @property
    def marketable_yield_percent(self) -> float:
        if not self.quantity_kg:
            return 0.0
        return round((self.marketable_yield_kg / self.quantity_kg) * 100, 2)

    @property
    def spoilage_rate_percent(self) -> float:
        if not self.quantity_kg:
            return 0.0
        return round(((self.spoilage_kg or 0) / self.quantity_kg) * 100, 2)

    @property
    def rejection_rate_percent(self) -> float:
        if not self.quantity_kg:
            return 0.0
        return round(((self.rejected_kg or 0) / self.quantity_kg) * 100, 2)


class Transport(Base):
    __tablename__ = "transport"

    id = Column(Integer, primary_key=True, index=True)
    harvest_id = Column(Integer, ForeignKey("harvest.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # worker assigned to deliver
    destination = Column(String(200), nullable=False)
    driver_name = Column(String(100), nullable=False, default="")
    vehicle_number = Column(String(50), nullable=False, default="")
    scheduled_date = Column(Date, nullable=False)
    actual_delivery = Column(Date, nullable=True)
    cargo_weight_kg = Column(Float, nullable=True)
    status = Column(String(20), default="pending")  # pending, in_transit, delivered, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    harvest = relationship("Harvest", back_populates="transports")
    user = relationship("User", back_populates="transports", foreign_keys=[user_id])
    driver = relationship("User", foreign_keys=[driver_id])

    @property
    def batch_number(self):
        return self.harvest.batch_number if self.harvest else None


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_type = Column(String(50), nullable=False)  # harvest, transport, inspection, maintenance, other
    assigned_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=True)
    priority = Column(String(20), default="medium")  # low, medium, high
    status = Column(String(20), default="pending")  # pending, in_progress, completed, cancelled
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="schedules")

    @property
    def worker_name(self):
        if not self.user:
            return None
        return self.user.full_name or self.user.username


class Waste(Base):
    __tablename__ = "waste"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    harvest_id = Column(Integer, ForeignKey("harvest.id"), nullable=True)
    waste_type = Column(String(100), nullable=False)  # rotten, damaged, overripe, unused_parts, other
    quantity_kg = Column(Float, nullable=False)
    waste_date = Column(Date, nullable=False)
    classification = Column(String(30), nullable=False, default="compostable")  # compostable, recyclable, non-recyclable
    disposal_method = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="waste_records")
    harvest = relationship("Harvest", back_populates="waste_records")

    @property
    def recorded_by(self) -> int:
        return self.user_id

    @property
    def batch_number(self):
        return self.harvest.batch_number if self.harvest else None


class QualityTarget(Base):
    """Management-defined thresholds for spoilage/rejection rates, compared against actual harvest data."""
    __tablename__ = "quality_targets"

    id = Column(Integer, primary_key=True, index=True)
    max_spoilage_rate = Column(Float, nullable=False, default=5.0)   # percent
    max_rejection_rate = Column(Float, nullable=False, default=5.0)  # percent
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class AILog(Base):
    __tablename__ = "ai_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    harvest_id = Column(Integer, ForeignKey("harvest.id"), nullable=True)
    prediction_type = Column(String(100), nullable=False)
    input_data = Column(Text, nullable=False)
    prediction_result = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=True)
    model_version = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    user = relationship("User", back_populates="ai_logs")
    harvest = relationship("Harvest", back_populates="ai_logs")


class AppSetting(Base):
    """System-wide settings, stored as a single JSON document"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(Text, nullable=False, default="{}")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
