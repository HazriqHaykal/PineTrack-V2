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
    transports = relationship("Transport", back_populates="user")
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
    harvest_id = Column(Integer, ForeignKey("harvest.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    destination = Column(String(200), nullable=False)
    transport_date = Column(Date, nullable=False)
    vehicle_id = Column(String(50), nullable=True)
    quantity_kg = Column(Float, nullable=False)
    status = Column(String(20), default="pending")  # pending, in_transit, delivered
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    harvest = relationship("Harvest", back_populates="transports")
    user = relationship("User", back_populates="transports")


class Schedule(Base):
    __tablename__ = "schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_type = Column(String(50), nullable=False)  # harvest, transport, maintenance, inspection
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=True)
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    status = Column(String(20), default="pending")  # pending, assigned, in_progress, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    user = relationship("User", back_populates="schedules")


class Waste(Base):
    __tablename__ = "waste"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    harvest_id = Column(Integer, ForeignKey("harvest.id"), nullable=True)
    waste_type = Column(String(100), nullable=False)  # rotten, damaged, unused_parts, other
    quantity_kg = Column(Float, nullable=False)
    waste_date = Column(Date, nullable=False)
    disposal_method = Column(String(100), nullable=True)  # compost, recycle, discard, donate
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    user = relationship("User", back_populates="waste_records")
    harvest = relationship("Harvest", back_populates="waste_records")


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
