"""
Report Generation API Endpoints
Handles PDF export
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from datetime import datetime
from app.config import get_db
from app.models import User
from app.middleware.rbac import require_admin
from app.services.report_generation_service import ReportGenerationService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/reports/health")
def report_health():
    """Health check for reports module"""
    return {
        "status": "healthy",
        "module": "reports",
        "timestamp": datetime.now().isoformat(),
        "features": {
            "pdf_export": True
        }
    }


@router.get("/reports/{report_type}")
def generate_report(
    report_type: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Generate a PDF report (admin only)

    - **report_type**: harvest, transport, waste, analytics, summary or full
    - **days**: Number of days to include (default: 30)

    Returns a PDF file download.
    """
    if report_type not in ReportGenerationService.REPORT_SECTIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown report type. Must be one of: {', '.join(ReportGenerationService.REPORT_SECTIONS)}"
        )

    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        buffer, filename = ReportGenerationService.generate_report(db, user, report_type, days)
    except Exception as e:
        logger.error(f"Error generating {report_type} report: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate report")

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
