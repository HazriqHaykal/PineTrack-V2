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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional['UserResponse'] = None

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
