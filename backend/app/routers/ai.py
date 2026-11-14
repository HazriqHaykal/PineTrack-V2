"""
AI Recommendation Engine API Routes
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker, require_admin
from app.schemas import AILogCreate, AILogResponse, AILogListResponse
from app.models import Harvest, Waste
from app.services.ai_service import AIService
from app.services.gemini_service import GeminiService
from app.services.waste_analysis_service import MAX_PER_REQUEST, WasteAnalysisService

router = APIRouter()


@router.get("/status")
def get_ai_status(current_user: dict = Depends(get_current_user)):
    """Which engine answers AI requests: Gemini, or the built-in rules when no API key is set"""
    return AIService.get_status()


@router.post("/predict/harvest-timing")
def predict_harvest_timing(
    harvest_id: int = Query(...),
    ripeness_level: float = Query(..., ge=0, le=10),
    days_since_last_harvest: int = Query(default=0, ge=0),
    field_condition_score: float = Query(default=5, ge=0, le=10),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Get AI recommendation for harvest timing

    - **harvest_id**: ID of harvest
    - **ripeness_level**: Ripeness level (0-10)
    - **days_since_last_harvest**: Days since last harvest (optional)
    - **field_condition_score**: Field condition score (0-10, optional)

    Returns recommendation with confidence score and explanation
    """
    is_valid, error_msg = AIService.validate_harvest_prediction_input(
        ripeness_level,
        days_since_last_harvest,
        field_condition_score
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Harvest {harvest_id} not found")

    # Workers can only run predictions on their own harvests
    if current_user.get("role") != "admin" and harvest.user_id != current_user.get("user_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only analyse your own harvests")

    prediction = AIService.predict_harvest_timing(
        db,
        harvest_id,
        ripeness_level,
        days_since_last_harvest,
        field_condition_score
    )

    ai_log = AILogCreate(
        harvest_id=harvest_id,
        prediction_type="harvest_timing",
        input_data={
            "ripeness_level": ripeness_level,
            "days_since_last_harvest": days_since_last_harvest,
            "field_condition_score": field_condition_score
        },
        prediction_result=prediction["recommendation"],
        confidence_score=prediction["confidence_score"],
        model_version=prediction["model_version"]
    )
    AIService.create_ai_log(db, ai_log, current_user.get("user_id"))

    return prediction


@router.post("/predict/waste-classification")
def predict_waste_classification(
    quality_grade: str = Query(...),
    damage_level: float = Query(default=0, ge=0, le=10),
    age_days: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Get AI recommendation for waste classification

    - **quality_grade**: Quality grade (A, B, C, D)
    - **damage_level**: Damage level (0-10, optional)
    - **age_days**: Age in days (optional)

    Returns waste classification, disposal method and explanation
    """
    is_valid, error_msg = AIService.validate_waste_prediction_input(
        quality_grade,
        damage_level,
        age_days
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    prediction = AIService.predict_waste_classification(
        db,
        quality_grade,
        damage_level,
        age_days
    )

    ai_log = AILogCreate(
        harvest_id=None,
        prediction_type="waste_classification",
        input_data={
            "quality_grade": quality_grade,
            "damage_level": damage_level,
            "age_days": age_days
        },
        prediction_result=prediction["waste_type"],
        confidence_score=prediction["confidence_score"],
        model_version=prediction["model_version"]
    )
    AIService.create_ai_log(db, ai_log, current_user.get("user_id"))

    return prediction


# ── Waste analysis ───────────────────────────────────────────────────────────

class WasteAnalysisRequest(BaseModel):
    waste_ids: List[int] = Field(..., min_length=1, max_length=MAX_PER_REQUEST)


def _visible_waste(db: Session, current_user: dict, ids: List[int] = None):
    """Waste records this user may see: all for admins, their own for workers"""
    query = db.query(Waste)
    if current_user.get("role") != "admin":
        query = query.filter(Waste.user_id == current_user.get("user_id"))
    if ids is not None:
        query = query.filter(Waste.id.in_(ids))
    return query.all()


@router.get("/waste-analysis")
def get_waste_analyses(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Latest stored PineTrack Agent analysis for each waste record the user can see,
    plus the assumed recovery rates used for value estimates.
    Records never analysed are absent from `items`.
    """
    analyses = WasteAnalysisService.latest(db, _visible_waste(db, current_user))
    return {
        "items": list(analyses.values()),
        "rates": WasteAnalysisService.rates(),
        "agent_available": GeminiService.is_configured(),
    }


@router.post("/waste-analysis")
def analyse_waste(
    body: WasteAnalysisRequest,
    current_user: dict = Depends(require_worker),
    db: Session = Depends(get_db)
):
    """
    Ask PineTrack Agent to analyse up to 25 waste records and recommend what to do with them.
    Uses built-in rules when Gemini is unavailable; each result names its source.
    Workers can only analyse their own records.
    """
    ids = list(dict.fromkeys(body.waste_ids))
    records = _visible_waste(db, current_user, ids)
    missing = set(ids) - {w.id for w in records}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Waste record(s) not found or not yours: {', '.join(map(str, sorted(missing)))}"
        )
    records.sort(key=lambda w: ids.index(w.id))
    return {"items": WasteAnalysisService.analyse(db, records, current_user.get("user_id"))}


@router.get("/recommendations")
def get_recommendations(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Latest farm-wide recommendations (admin only); generated on first use"""
    return AIService.get_recommendations(db, current_user.get("user_id"))


@router.post("/recommendations/refresh")
def refresh_recommendations(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Generate a new set of recommendations from the current farm data (admin only)"""
    return AIService.get_recommendations(db, current_user.get("user_id"), refresh=True)


@router.get("/logs", response_model=AILogListResponse)
def list_ai_logs(
    prediction_type: str = Query(None),
    model_version: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List AI prediction logs (admin only)

    - **prediction_type**: Filter by prediction type
    - **model_version**: Filter by model version
    - **skip**: Pagination offset
    - **limit**: Pagination limit
    """
    logs, total = AIService.list_ai_logs(
        db,
        prediction_type,
        model_version,
        skip,
        limit
    )

    return {
        "items": logs,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/logs/{log_id}", response_model=AILogResponse)
def get_ai_log(
    log_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get specific AI prediction log by ID (admin only)"""
    log = AIService.get_ai_log_by_id(db, log_id)

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI log not found"
        )

    return log


@router.get("/metrics")
def get_ai_metrics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI usage metrics"""
    metrics = AIService.get_ai_metrics(db)
    return metrics
