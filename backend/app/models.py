"""
SQLAlchemy ORM Models for PineTrack V2.0
"""

from sqlalchemy import (
    CheckConstraint, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Date, Time, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from .config import Base
from .services.yield_calc import compute_yield

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
    # Deleted by the ORM rather than ON DELETE CASCADE, which SQLite does not enforce by default
    events = relationship("BatchEvent", back_populates="batch", cascade="all, delete-orphan")

    # The grading breakdown (FR08); empty for legacy and ungraded batches
    grades = relationship(
        "HarvestGrade", back_populates="harvest", cascade="all, delete-orphan",
        lazy="selectin", order_by="HarvestGrade.grade",
    )

    @property
    def worker_id(self) -> int:
        return self.user_id

    @property
    def yield_breakdown(self) -> dict:
        """Marketable quantity from the single calculation in services/yield_calc.py"""
        return compute_yield(
            self.quantity_kg, self.spoilage_kg, self.rejected_kg,
            [(g.grade, g.quantity_kg, g.is_marketable) for g in self.grades],
            self.quality_grade,
        )

    @property
    def marketable_yield_kg(self) -> float:
        return float(self.yield_breakdown["marketable"])

    @property
    def marketable_yield_percent(self) -> float:
        return float(self.yield_breakdown["marketable_percent"])

    @property
    def spoilage_rate_percent(self) -> float:
        if not self.quantity_kg:
            return 0.0
        return round(((self.spoilage_kg or 0) / self.quantity_kg) * 100, 2)

    @property
    def rejection_rate_percent(self) -> float:
        if not self.quantity_kg:
            return 0.0
        return round((float(self.yield_breakdown["rejected"]) / self.quantity_kg) * 100, 2)

    # Grading breakdown, as served to the frontend

    @property
    def grading_basis(self) -> str:
        """grade_based, legacy (one overall grade, before breakdowns existed) or ungraded"""
        return self.yield_breakdown["basis"]

    @property
    def grade_quantities(self):
        grades = self.yield_breakdown["grades"]
        return {g: float(q) for g, q in grades.items()} if grades is not None else None

    @property
    def marketable_grades(self):
        return self.yield_breakdown["marketable_grades"]

    @property
    def graded_marketable_kg(self):
        value = self.yield_breakdown["graded_marketable"]
        return float(value) if value is not None else None

    @property
    def non_marketable_kg(self):
        value = self.yield_breakdown["non_marketable"]
        return float(value) if value is not None else None

    @property
    def rejected_at_sorting_kg(self):
        value = self.yield_breakdown["rejected_at_sorting"]
        return float(value) if value is not None else None

    @property
    def rejected_after_grading_kg(self):
        value = self.yield_breakdown["rejected_after_grading"]
        return float(value) if value is not None else None

    @property
    def grading_yield_percent(self):
        value = self.yield_breakdown["grading_percent"]
        return float(value) if value is not None else None

    @property
    def grading_policy_version(self):
        versions = {g.policy_id for g in self.grades if g.policy_id is not None}
        return max(versions) if versions else None


class HarvestGrade(Base):
    """
    Quantity of one quality grade in a harvest batch, entered by the farmer.

    is_marketable is copied from the marketability policy in force when the
    quantity was saved, so a later policy change does not alter this batch.
    """
    __tablename__ = "harvest_grades"
    __table_args__ = (
        UniqueConstraint("harvest_id", "grade", name="uq_harvest_grades_harvest_grade"),
        CheckConstraint("quantity_kg >= 0", name="ck_harvest_grades_quantity_nonnegative"),
        CheckConstraint("grade IN ('A', 'B', 'C', 'D')", name="ck_harvest_grades_grade"),
    )

    id = Column(Integer, primary_key=True, index=True)
    harvest_id = Column(Integer, ForeignKey("harvest.id", ondelete="CASCADE"), nullable=False, index=True)
    grade = Column(String(1), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    is_marketable = Column(Boolean, nullable=False)
    policy_id = Column(Integer, ForeignKey("marketability_policies.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    harvest = relationship("Harvest", back_populates="grades")


class MarketabilityPolicy(Base):
    """
    Which grades the farm sells. Never edited in place: each change adds a new
    row, so the id is the policy version and the table is its audit trail.
    """
    __tablename__ = "marketability_policies"

    id = Column(Integer, primary_key=True, index=True)
    marketable_grades = Column(String(20), nullable=False)  # comma separated, e.g. "A,B,C"
    note = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    author = relationship("User")

    @property
    def grades(self) -> list:
        return [g for g in (self.marketable_grades or "").split(",") if g]


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


class BatchEvent(Base):
    """
    One entry in a harvest batch's traceability timeline.

    Written by the backend in the same transaction as the change it describes,
    and only when something actually changed, so a retried request adds nothing.
    """
    __tablename__ = "batch_events"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("harvest.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null for system actions
    related_module = Column(String(20), nullable=False)  # harvest, transport, waste
    related_record_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    # "metadata" is reserved on declarative classes, so the attribute is named differently
    event_metadata = Column("metadata", Text, nullable=False, default="{}")  # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batch = relationship("Harvest", back_populates="events")
    actor = relationship("User")


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
