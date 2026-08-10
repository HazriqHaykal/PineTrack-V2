"""
AI Recommendation Engine API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.config import get_db
from app.middleware.rbac import get_current_user, require_worker
from app.schemas import AILogCreate
from app.services.ai_service import AIService

router = APIRouter()


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
    
    Returns recommendation with confidence score
    """
    # Validate input
    is_valid, error_msg = AIService.validate_harvest_prediction_input(
        ripeness_level,
        days_since_last_harvest,
        field_condition_score
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Get prediction
    prediction = AIService.predict_harvest_timing(
        db,
        harvest_id,
        ripeness_level,
        days_since_last_harvest,
        field_condition_score
    )
    
    # Log prediction
    user_id = current_user.get("user_id")
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
        model_version="v2.0"
    )
    AIService.create_ai_log(db, ai_log, user_id)
    
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
    
    Returns waste classification and disposal method
    """
    # Validate input
    is_valid, error_msg = AIService.validate_waste_prediction_input(
        quality_grade,
        damage_level,
        age_days
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    
    # Get prediction
    prediction = AIService.predict_waste_classification(
        db,
        quality_grade,
        damage_level,
        age_days
    )
    
    # Log prediction
    user_id = current_user.get("user_id")
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
        model_version="v2.0"
    )
    AIService.create_ai_log(db, ai_log, user_id)
    
    return prediction


@router.get("/logs")
def list_ai_logs(
    prediction_type: str = Query(None),
    model_version: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List AI prediction logs
    
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


@router.get("/logs/{log_id}")
def get_ai_log(
    log_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific AI prediction log by ID"""
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
    """Get AI model performance metrics"""
    metrics = AIService.get_ai_metrics(db)
    return metrics
