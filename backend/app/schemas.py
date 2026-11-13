"""
Pydantic schemas for request/response validation
"""

import json
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime, date, time
from typing import Optional, List

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

class HarvestCreate(HarvestBase):
    pass

class HarvestUpdate(BaseModel):
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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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



# ==============================================================================
# SULUR INVENTORY & TRACKING SCHEMAS (MUHAMMAD ARIF OMAR BIN AKASHAH)
# ==============================================================================

class SulurBatchBase(BaseModel):
    variety: str = Field(..., max_length=50)
    sulur_type: str = Field("sucker", max_length=30)
    size_grade: str = Field("Grade A", max_length=20)
    initial_quantity: int = Field(..., gt=0)
    source_plot: str = Field(..., max_length=100)
    storage_location: str = Field("Nursery Shed 1", max_length=100)
    date_received: date
    treatment_status: str = Field("raw", max_length=30)
    quality_remarks: Optional[str] = None

class SulurBatchCreate(SulurBatchBase):
    batch_code: Optional[str] = None
    is_certified: bool = False
    certified_by: Optional[str] = None

class SulurBatchUpdate(BaseModel):
    variety: Optional[str] = None
    sulur_type: Optional[str] = None
    size_grade: Optional[str] = None
    storage_location: Optional[str] = None
    treatment_status: Optional[str] = None
    stock_status: Optional[str] = None
    is_certified: Optional[bool] = None
    certified_by: Optional[str] = None
    quality_remarks: Optional[str] = None

class SulurMovementCreate(BaseModel):
    batch_id: int
    movement_type: str = Field(..., description="stock_in, reserve, release_reserve, plant, sell, transfer, damage")
    quantity: int = Field(..., gt=0)
    destination_or_plot: Optional[str] = None
    movement_date: Optional[date] = None
    remarks: Optional[str] = None

class SulurMovementResponse(BaseModel):
    id: int
    batch_id: int
    batch_code: Optional[str] = None
    user_id: int
    recorded_by_name: Optional[str] = None
    movement_type: str
    quantity: int
    destination_or_plot: Optional[str] = None
    movement_date: date
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SulurBatchResponse(SulurBatchBase):
    id: int
    user_id: int
    batch_code: str
    available_quantity: int
    reserved_quantity: int
    planted_quantity: int
    sold_quantity: int
    damaged_quantity: int
    stock_status: str
    is_certified: bool
    certificate_number: Optional[str] = None
    certified_by: Optional[str] = None
    certified_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SulurBatchListResponse(BaseModel):
    total: int
    items: List[SulurBatchResponse]
    skip: int = 0
    limit: int = 100

class SulurReferenceConfigBase(BaseModel):
    variety: str
    default_planting_density_ha: int = 43500
    npk_fertilizer_kg_per_1000: float = 42.0
    foliar_fertilizer_l_per_1000: float = 3.5
    sulur_unit_cost_rm: float = 0.80
    sulur_selling_price_rm: float = 1.50
    fruit_selling_price_rm_kg: float = 3.50
    avg_fruit_weight_kg: float = 1.6
    nutrient_cost_per_1000_rm: float = 360.0
    operational_cost_per_ha_rm: float = 5000.0
    min_stock_threshold: int = 5000

class SulurReferenceConfigResponse(SulurReferenceConfigBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

class SulurPlanCreate(BaseModel):
    plan_title: str = Field(..., min_length=2, max_length=120)
    variety: str
    plan_mode: str = Field("cultivation", description="cultivation or sulur_sales")
    land_area_ha: float = Field(..., gt=0)
    planting_density_ha: Optional[int] = Field(None, gt=0)
    mortality_buffer_percent: float = Field(5.0, ge=0, le=50)
    custom_selling_price_rm: Optional[float] = Field(None, gt=0)
    custom_sulur_cost_rm: Optional[float] = Field(None, ge=0)
    custom_nutrient_cost_rm: Optional[float] = Field(None, ge=0)
    custom_operational_cost_rm: Optional[float] = Field(None, ge=0)

class SulurRecommendationItem(BaseModel):
    rule_code: str
    severity: str  # critical, warning, info, optimal
    category: str  # stock, profit, nutrient, quality
    message: str
    action_suggested: str

class SulurPlanResponse(BaseModel):
    id: int
    user_id: int
    plan_title: str
    variety: str
    plan_mode: str
    land_area_ha: float
    planting_density_ha: int
    mortality_buffer_percent: float
    required_sulur: int
    available_sulur_at_plan: int
    stock_shortfall: int
    estimated_npk_kg: float
    estimated_foliar_liters: float
    sulur_cost_rm: float
    nutrient_cost_rm: float
    operational_cost_rm: float
    total_cost_rm: float
    estimated_revenue_rm: float
    projected_profit_rm: float
    roi_percent: float
    recommendations: List[SulurRecommendationItem] = []
    created_at: datetime

    class Config:
        from_attributes = True
