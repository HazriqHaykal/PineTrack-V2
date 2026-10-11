"""
Analytics, System Settings and Data Export API Routes
"""

import csv
import io
import json
import zipfile
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Dict
from app.config import get_db
from app.middleware.rbac import require_admin
from app.models import AppSetting, Harvest, Transport, Waste, Schedule, User
from app.services.analytics_service import AnalyticsService

router = APIRouter()

DEFAULT_SETTINGS = {
    "farm_name": "PineTrack Farm",
    "timezone": "Asia/Kuala_Lumpur",
    "language": "English",
    "notifications": {},
    "security": {},
}


class SettingsUpdate(BaseModel):
    farm_name: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(..., max_length=50)
    language: str = Field(..., max_length=30)
    notifications: Dict[str, bool] = {}
    security: Dict[str, bool] = {}


@router.get("/analytics/overview")
def get_analytics_overview(
    months: int = Query(6, ge=1, le=24),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Dashboard and analytics data (admin only)

    - **months**: How many calendar months the trend charts cover
    """
    return AnalyticsService.get_overview(db, months)


@router.get("/settings")
def get_settings(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get system settings (admin only)"""
    row = db.query(AppSetting).first()
    stored = json.loads(row.data) if row else {}
    return {**DEFAULT_SETTINGS, **stored}


@router.put("/settings")
def update_settings(
    data: SettingsUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Save system settings (admin only)"""
    row = db.query(AppSetting).first()
    if not row:
        row = AppSetting()
        db.add(row)

    row.data = json.dumps(data.model_dump())
    db.commit()
    return data


# Columns written for each table. Password hashes are deliberately never exported.
EXPORT_TABLES = {
    "users": (User, ["id", "username", "email", "full_name", "role", "is_active", "created_at"]),
    "harvest": (Harvest, [
        "id", "batch_number", "user_id", "field_name", "harvest_date", "quantity_kg", "quality_grade",
        "ripeness_level", "harvest_status", "spoilage_kg", "rejected_kg", "marketable_yield_kg", "notes", "created_at",
    ]),
    "transport": (Transport, [
        "id", "harvest_id", "batch_number", "driver_id", "driver_name", "vehicle_number", "destination",
        "scheduled_date", "actual_delivery", "cargo_weight_kg", "status", "notes", "created_at",
    ]),
    "waste": (Waste, [
        "id", "harvest_id", "batch_number", "user_id", "waste_type", "quantity_kg", "waste_date",
        "classification", "disposal_method", "notes", "created_at",
    ]),
    "schedules": (Schedule, [
        "id", "worker_id", "worker_name", "task_type", "assigned_date", "scheduled_time",
        "priority", "status", "details", "created_at",
    ]),
}


def _csv_cell(value):
    """Blank for missing values; text starting with a formula character is quoted so
    spreadsheet programs show it as text instead of running it"""
    if value is None:
        return ""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
        return "'" + value
    return value


@router.get("/export")
def export_all_data(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Download every table as CSV files inside one zip archive (admin only)"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, (model, columns) in EXPORT_TABLES.items():
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow(columns)
            for row in db.query(model).order_by(model.id).all():
                writer.writerow([_csv_cell(getattr(row, c)) for c in columns])
            # utf-8-sig so Excel opens the files with the right encoding
            archive.writestr(f"{name}.csv", out.getvalue().encode("utf-8-sig"))

    filename = f"pinetrack_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
