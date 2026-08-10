"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
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
    password: Optional[str] = None

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
    destination: str = Field(..., max_length=200)
    transport_date: date
    vehicle_id: Optional[str] = None
    quantity_kg: float = Field(..., gt=0)
    status: str = "pending"
    notes: Optional[str] = None

class TransportCreate(TransportBase):
    harvest_id: int

class TransportUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class TransportResponse(TransportBase):
    id: int
    harvest_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Schedule Schemas
class ScheduleBase(BaseModel):
    task_type: str = Field(..., max_length=50)
    scheduled_date: date
    scheduled_time: Optional[time] = None
    priority: str = "normal"
    notes: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ScheduleResponse(ScheduleBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Waste Schemas
class WasteBase(BaseModel):
    waste_type: str = Field(..., max_length=100)
    quantity_kg: float = Field(..., gt=0)
    waste_date: date
    disposal_method: Optional[str] = None
    notes: Optional[str] = None

class WasteCreate(WasteBase):
    harvest_id: Optional[int] = None

class WasteUpdate(BaseModel):
    disposal_method: Optional[str] = None
    notes: Optional[str] = None

class WasteResponse(WasteBase):
    id: int
    user_id: int
    harvest_id: Optional[int]
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
    harvest_id: Optional[int] = None
    input_data: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Batch Response Schemas
class HarvestListResponse(BaseModel):
    total: int
    items: List[HarvestResponse]

class TransportListResponse(BaseModel):
    total: int
    items: List[TransportResponse]

class ScheduleListResponse(BaseModel):
    total: int
    items: List[ScheduleResponse]

class WasteListResponse(BaseModel):
    total: int
    items: List[WasteResponse]
