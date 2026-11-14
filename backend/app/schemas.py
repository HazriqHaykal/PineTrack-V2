"""
Pydantic schemas for request/response validation
"""

import json
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import datetime, date, time
from typing import Dict, Literal, Optional, List

# Auth Schemas
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)

# User Schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "worker"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)

class UserAdminUpdate(UserUpdate):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None

# Harvest Schemas
class HarvestBase(BaseModel):
    field_name: str = Field(..., max_length=100)
    harvest_date: date
    quantity_kg: float = Field(..., gt=0)
    quality_grade: Optional[str] = None
    ripeness_level: Optional[float] = Field(None, ge=0, le=10)
    notes: Optional[str] = None

# Kilograms per grade, e.g. {"A": 100, "B": 60, "C": 25, "D": 15}. Grades left
# out count as 0 kg. Leave the whole field out for a batch not graded yet.
GradeQuantities = Dict[str, Optional[float]]

class HarvestCreate(HarvestBase):
    grades: Optional[GradeQuantities] = None
    # Fruit sorted out as unsellable at harvest; part of quantity_kg, logged in Waste Management
    non_marketable_kg: Optional[float] = Field(None, ge=0)
    non_marketable_reason: Optional[str] = None  # waste type: damaged, rotten, overripe, other

class HarvestUpdate(BaseModel):
    grades: Optional[GradeQuantities] = None
    # With grades: the non-marketable kg sorted out (A+B+C+D + this = harvested). Defaults to 0.
    non_marketable_kg: Optional[float] = Field(None, ge=0)
    non_marketable_reason: Optional[str] = None
    quality_grade: Optional[str] = None
    ripeness_level: Optional[float] = Field(None, ge=0, le=10)
    harvest_status: Optional[str] = None
    spoilage_kg: Optional[float] = Field(None, ge=0)
    rejected_kg: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

class HarvestResponse(HarvestBase):
    id: int
    user_id: int
    worker_id: int
    batch_number: str
    harvest_status: str
    spoilage_kg: float
    rejected_kg: float
    marketable_yield_kg: float
    marketable_yield_percent: float
    spoilage_rate_percent: float
    rejection_rate_percent: float
    grading_basis: str  # grade_based, legacy or ungraded
    grade_quantities: Optional[Dict[str, float]] = None
    marketable_grades: Optional[List[str]] = None
    graded_marketable_kg: Optional[float] = None
    non_marketable_kg: Optional[float] = None  # grades the policy excludes
    rejected_at_sorting_kg: Optional[float] = None  # non-marketable kg sorted out at harvest
    rejected_after_grading_kg: Optional[float] = None
    grading_yield_percent: Optional[float] = None
    grading_policy_version: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Marketability policy (which grades count as marketable)
class MarketabilityPolicyUpdate(BaseModel):
    marketable_grades: List[str]
    note: Optional[str] = Field(None, max_length=500)

class MarketabilityPolicyResponse(BaseModel):
    version: int
    marketable_grades: List[str]
    non_marketable_grades: List[str]
    note: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None
    is_current: bool
    explanation: str

class GradeRow(BaseModel):
    grade: str
    quantity_kg: float
    percent: float
    is_marketable: bool

class BatchGrading(BaseModel):
    basis: str
    grades: List[GradeRow]
    harvested_kg: float
    graded_marketable_kg: Optional[float] = None
    non_marketable_kg: Optional[float] = None
    rejected_at_sorting_kg: Optional[float] = None
    rejected_after_grading_kg: Optional[float] = None
    spoilage_kg: float
    rejected_kg: float
    marketable_kg: float
    marketable_yield_percent: float
    grading_yield_percent: Optional[float] = None
    marketable_grades: Optional[List[str]] = None
    policy_version: Optional[int] = None
    current_policy_version: Optional[int] = None
    legacy_grade: Optional[str] = None
    policy_explanation: str

# Quality Target Schemas (management-defined spoilage/rejection thresholds)
class QualityTargetUpdate(BaseModel):
    max_spoilage_rate: float = Field(..., ge=0, le=100)
    max_rejection_rate: float = Field(..., ge=0, le=100)

class QualityTargetResponse(QualityTargetUpdate):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

# Transport Schemas
class TransportBase(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200)
    driver_name: str = Field("", max_length=100)
    vehicle_number: str = Field("", max_length=50)
    scheduled_date: date
    cargo_weight_kg: Optional[float] = Field(None, gt=0)
    status: str = "pending"
    notes: Optional[str] = None

class TransportCreate(TransportBase):
    harvest_id: Optional[int] = None
    driver_id: Optional[int] = None

class TransportUpdate(BaseModel):
    destination: Optional[str] = Field(None, min_length=1, max_length=200)
    driver_name: Optional[str] = Field(None, max_length=100)
    vehicle_number: Optional[str] = Field(None, max_length=50)
    scheduled_date: Optional[date] = None
    actual_delivery: Optional[date] = None
    cargo_weight_kg: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None
    notes: Optional[str] = None
    harvest_id: Optional[int] = None
    driver_id: Optional[int] = None

class TransportResponse(TransportBase):
    id: int
    harvest_id: Optional[int] = None
    driver_id: Optional[int] = None
    batch_number: Optional[str] = None
    user_id: int
    actual_delivery: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Schedule Schemas
class ScheduleBase(BaseModel):
    task_type: str = Field(..., max_length=50)
    assigned_date: date
    scheduled_time: Optional[time] = None
    priority: str = "medium"
    details: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    worker_id: Optional[int] = None  # defaults to the creating admin
    status: str = "pending"

class ScheduleUpdate(BaseModel):
    task_type: Optional[str] = Field(None, max_length=50)
    assigned_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    details: Optional[str] = None
    worker_id: Optional[int] = None

class ScheduleResponse(ScheduleBase):
    id: int
    worker_id: int
    worker_name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Waste Schemas
class WasteBase(BaseModel):
    waste_type: str = Field(..., max_length=100)
    quantity_kg: float = Field(..., gt=0)
    classification: str = "compostable"
    disposal_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class WasteCreate(WasteBase):
    waste_date: Optional[date] = None  # defaults to today
    harvest_id: Optional[int] = None

class WasteUpdate(BaseModel):
    waste_type: Optional[str] = Field(None, max_length=100)
    quantity_kg: Optional[float] = Field(None, gt=0)
    waste_date: Optional[date] = None
    classification: Optional[str] = None
    disposal_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    harvest_id: Optional[int] = None

class WasteResponse(WasteBase):
    id: int
    user_id: int
    recorded_by: int
    harvest_id: Optional[int] = None
    batch_number: Optional[str] = None
    waste_date: date
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# AILog Schemas
class AILogBase(BaseModel):
    prediction_type: str
    prediction_result: str
    confidence_score: Optional[float] = None
    model_version: Optional[str] = None

class AILogCreate(AILogBase):
    harvest_id: Optional[int] = None
    input_data: dict

class AILogResponse(AILogBase):
    id: int
    user_id: int
    harvest_id: Optional[int] = None
    input_data: dict
    created_at: datetime

    @field_validator("input_data", mode="before")
    @classmethod
    def parse_input_data(cls, value):
        # Stored as a JSON string in the database
        return json.loads(value) if isinstance(value, str) else value
    
    class Config:
        from_attributes = True

# Batch Response Schemas
class HarvestListResponse(BaseModel):
    total: int
    items: List[HarvestResponse]
    skip: int = 0
    limit: int = 100

class TransportListResponse(BaseModel):
    total: int
    items: List[TransportResponse]
    skip: int = 0
    limit: int = 100

class ScheduleListResponse(BaseModel):
    total: int
    items: List[ScheduleResponse]
    skip: int = 0
    limit: int = 100

class WasteListResponse(BaseModel):
    total: int
    items: List[WasteResponse]
    skip: int = 0
    limit: int = 100

class UserWithStatsResponse(UserResponse):
    tasks_total: int = 0
    tasks_completed: int = 0

class UserListResponse(BaseModel):
    total: int
    items: List[UserWithStatsResponse]
    skip: int = 0
    limit: int = 100

class AILogListResponse(BaseModel):
    total: int
    items: List[AILogResponse]
    skip: int = 0
    limit: int = 100

# Batch traceability schemas
class BatchLifecycle(BaseModel):
    code: str
    label: str
    reason: str

class BatchReconciliation(BaseModel):
    unit: str = "kg"
    grading_basis: str
    marketable_yield_percent: float
    harvested_kg: float
    spoilage_kg: float
    rejected_kg: float
    non_marketable_kg: float = 0
    rejected_at_sorting_kg: float = 0
    marketable_kg: float
    pending_kg: float
    in_transit_kg: float
    reserved_kg: float
    delivered_kg: float
    dispatched_kg: float
    available_kg: float
    withheld_kg: float
    over_allocated_kg: float
    unquantified_transports: int
    waste_recorded_kg: float
    recorded_losses_kg: float
    unclassified_losses_kg: float
    waste_exceeds_losses_kg: float
    waste_policy: str

class BatchEventResponse(BaseModel):
    id: int
    batch_id: int
    event_type: str
    actor_user_id: Optional[int] = None
    actor_name: str
    related_module: str
    related_record_id: Optional[int] = None
    description: str
    metadata: dict
    created_at: datetime

class BatchEventListResponse(BaseModel):
    total: int
    items: List[BatchEventResponse]
    skip: int = 0
    limit: int = 200
    event_types: List[str]
    history_complete: bool
    history_note: Optional[str] = None

class BatchTransportsResponse(BaseModel):
    items: List[TransportResponse]
    hidden_count: int = 0  # linked records this user is not allowed to open

class BatchWasteResponse(BaseModel):
    items: List[WasteResponse]
    hidden_count: int = 0

class BatchDetailsResponse(BaseModel):
    batch: HarvestResponse
    created_by: Optional[str] = None
    lifecycle: BatchLifecycle
    quantities: BatchReconciliation
    grading: BatchGrading
    transports: BatchTransportsResponse
    waste: BatchWasteResponse
    history_complete: bool
    history_note: Optional[str] = None

class BatchSummary(BaseModel):
    harvest_id: int
    lifecycle_status: str
    lifecycle_label: str
    marketable_kg: float
    reserved_kg: float
    delivered_kg: float
    available_kg: float

class BatchSummaryListResponse(BaseModel):
    items: List[BatchSummary]

# Harvest & Profit Planner (FR12)
# Upper bound on planner inputs, to keep requests sane
LIMIT = Decimal("1000000000")

class PlannerInput(BaseModel):
    """Planning assumptions. Money in RM, quantities in kg, land in hectares."""
    mode: Literal["target_profit", "forecast"]
    selling_price_per_kg: Decimal = Field(..., gt=0, le=LIMIT)
    variable_cost_per_kg: Decimal = Field(..., ge=0, le=LIMIT)  # per MARKETABLE kg
    fixed_cost: Decimal = Field(..., ge=0, le=LIMIT)
    marketable_yield_percent: Decimal = Field(..., gt=0, le=100)
    productivity_kg_per_ha: Decimal = Field(..., gt=0, le=LIMIT)
    target_profit: Optional[Decimal] = Field(None, ge=0, le=LIMIT)
    planned_harvest_kg: Optional[Decimal] = Field(None, gt=0, le=LIMIT)
    land_area_ha: Optional[Decimal] = Field(None, gt=0, le=LIMIT)

    @model_validator(mode="after")
    def check_mode_inputs(self):
        if self.mode == "target_profit":
            if self.target_profit is None:
                raise ValueError("target_profit is required for target-profit planning")
        else:
            given = [v for v in (self.planned_harvest_kg, self.land_area_ha) if v is not None]
            if len(given) != 1:
                raise ValueError("Enter either planned_harvest_kg or land_area_ha (exactly one) for a harvest forecast")
        return self

class PlannerStep(BaseModel):
    label: str
    formula: str
    working: str

class PlannerResult(BaseModel):
    mode: str
    calculation_version: str
    harvest_kg: float
    marketable_kg: float
    land_ha: float
    revenue: float
    variable_cost: float
    fixed_cost: float
    total_cost: float
    profit: float
    profit_margin_percent: Optional[float] = None
    contribution_per_kg: float
    break_even_marketable_kg: Optional[float] = None
    harvest_source: str
    assumptions: dict
    notes: List[str]
    disclaimer: str
    steps: List[PlannerStep]

class PlannerScenario(BaseModel):
    label: str = Field(..., min_length=1, max_length=40)
    inputs: PlannerInput

class PlannerCompareRequest(BaseModel):
    scenarios: List[PlannerScenario] = Field(..., min_length=1, max_length=5)

class PlannerScenarioResult(BaseModel):
    label: str
    result: Optional[PlannerResult] = None
    error: Optional[str] = None  # the scenario cannot reach its target under the model

class PlannerCompareResponse(BaseModel):
    items: List[PlannerScenarioResult]

class WhatIfScenario(BaseModel):
    label: str
    inputs: Dict[str, float]  # the assumptions this scenario used
    result: Optional[PlannerResult] = None
    error: Optional[str] = None

class WhatIfRule(BaseModel):
    field: str
    label: str
    unit: str
    conservative: str
    optimistic: str

class WhatIfResponse(BaseModel):
    scenarios: List[WhatIfScenario]
    rules: List[WhatIfRule]
    note: str

class HistoricalYieldResponse(BaseModel):
    available: bool
    marketable_yield_percent: Optional[float] = None
    period_start: date
    period_end: date
    months: int
    included_batches: int
    harvested_kg: float
    marketable_kg: float
    excluded_legacy_batches: int
    excluded_ungraded_batches: int
    min_batches: int
    rules: str
    message: Optional[str] = None
