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



# ==============================================================================
# SULUR INVENTORY & TRACKING MODULE (MUHAMMAD ARIF OMAR BIN AKASHAH)
# ==============================================================================

class SulurBatch(Base):
    """Pineapple seed (sulur) batch registry, grading, and certification status."""
    __tablename__ = "sulur_batches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)
    variety = Column(String(50), nullable=False)  # MD2, Moris, Josapine, N36, Yankee
    sulur_type = Column(String(30), nullable=False, default="sucker")  # sucker (sulur tangkai/bapa), slip, crown
    size_grade = Column(String(20), nullable=False, default="Grade A")  # Grade A (>400g / 30-45cm), Grade B, Grade C
    initial_quantity = Column(Integer, nullable=False)
    available_quantity = Column(Integer, nullable=False)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    planted_quantity = Column(Integer, nullable=False, default=0)
    sold_quantity = Column(Integer, nullable=False, default=0)
    damaged_quantity = Column(Integer, nullable=False, default=0)
    source_plot = Column(String(100), nullable=False)  # e.g., Block A - Seri Nanas Farm
    storage_location = Column(String(100), nullable=False, default="Nursery Shed 1")
    date_received = Column(Date, nullable=False)
    treatment_status = Column(String(30), nullable=False, default="raw")  # raw, curing, fungicide_treated, ready_to_plant
    stock_status = Column(String(30), nullable=False, default="available")  # available, reserved, low_stock, depleted, damaged
    
    # Management Quality Certification (Addressing Supervisor Feedback)
    is_certified = Column(Boolean, default=False, nullable=False)
    certificate_number = Column(String(60), unique=True, nullable=True)
    certified_by = Column(String(100), nullable=True)
    certified_date = Column(Date, nullable=True)
    quality_remarks = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="sulur_batches")
    movements = relationship("SulurMovement", back_populates="batch", cascade="all, delete-orphan")


class SulurMovement(Base):
    """Full stock movement ledger for batch traceability."""
    __tablename__ = "sulur_movements"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sulur_batches.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    movement_type = Column(String(30), nullable=False)  # stock_in, stock_out, reserve, release_reserve, plant, sell, transfer, damage
    quantity = Column(Integer, nullable=False)
    destination_or_plot = Column(String(120), nullable=True)
    movement_date = Column(Date, nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batch = relationship("SulurBatch", back_populates="movements")
    user = relationship("User", backref="sulur_movements")

    @property
    def batch_code(self) -> str:
        return self.batch.batch_code if self.batch else ""

    @property
    def recorded_by_name(self) -> str:
        if not self.user:
            return ""
        return self.user.full_name or self.user.username


class SulurReferenceConfig(Base):
    """LPNM/MPIB reference values for planting density, nutrient rate, selling price, and costs per variety."""
    __tablename__ = "sulur_reference_configs"

    id = Column(Integer, primary_key=True, index=True)
    variety = Column(String(50), unique=True, index=True, nullable=False)  # MD2, Moris, Josapine, N36
    default_planting_density_ha = Column(Integer, nullable=False, default=43500)  # trees per hectare
    npk_fertilizer_kg_per_1000 = Column(Float, nullable=False, default=42.0)  # kg NPK per 1,000 sulur
    foliar_fertilizer_l_per_1000 = Column(Float, nullable=False, default=3.5)  # liters foliar per 1,000 sulur
    sulur_unit_cost_rm = Column(Float, nullable=False, default=0.80)  # RM per sulur seed
    sulur_selling_price_rm = Column(Float, nullable=False, default=1.50)  # LPNM reference selling price per sulur
    fruit_selling_price_rm_kg = Column(Float, nullable=False, default=3.50)  # Expected fruit price RM/kg
    avg_fruit_weight_kg = Column(Float, nullable=False, default=1.6)  # Expected kg per harvested fruit
    nutrient_cost_per_1000_rm = Column(Float, nullable=False, default=360.0)  # RM nutrient cost per 1,000 sulur
    operational_cost_per_ha_rm = Column(Float, nullable=False, default=5000.0)  # RM labour/land prep per ha
    min_stock_threshold = Column(Integer, nullable=False, default=5000)  # Low stock alert threshold
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SulurPlanRecord(Base):
    """Saved seed quantity, nutrient estimation, profit calculation, and rule-based DSS recommendations."""
    __tablename__ = "sulur_plan_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_title = Column(String(120), nullable=False)
    variety = Column(String(50), nullable=False)
    plan_mode = Column(String(30), nullable=False, default="cultivation")  # cultivation or sulur_sales
    land_area_ha = Column(Float, nullable=False)
    planting_density_ha = Column(Integer, nullable=False, default=43500)
    mortality_buffer_percent = Column(Float, nullable=False, default=5.0)
    required_sulur = Column(Integer, nullable=False)
    available_sulur_at_plan = Column(Integer, nullable=False, default=0)
    stock_shortfall = Column(Integer, nullable=False, default=0)

    # Nutrient estimations
    estimated_npk_kg = Column(Float, nullable=False, default=0.0)
    estimated_foliar_liters = Column(Float, nullable=False, default=0.0)

    # Financial & Profit estimations (RM)
    sulur_cost_rm = Column(Float, nullable=False, default=0.0)
    nutrient_cost_rm = Column(Float, nullable=False, default=0.0)
    operational_cost_rm = Column(Float, nullable=False, default=0.0)
    total_cost_rm = Column(Float, nullable=False, default=0.0)
    estimated_revenue_rm = Column(Float, nullable=False, default=0.0)
    projected_profit_rm = Column(Float, nullable=False, default=0.0)
    roi_percent = Column(Float, nullable=False, default=0.0)

    # Rule-based DSS JSON string of recommendations
    recommendations_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="sulur_plans")
