"""
Report Generation and Model Training API Endpoints
Handles PDF export and ML model training
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.schemas import UserResponse
from app.routers.auth import get_current_user
from app.services.report_generation_service import ReportGenerationService
from app.services.ml_training_service import MLTrainingService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/reports/summary")
async def generate_summary_report(
    days: int = 30,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate comprehensive PDF report
    
    Parameters:
    - days: Number of days to include (default: 30)
    
    Returns:
    - PDF file download
    """
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
        
        buffer, filename = ReportGenerationService.generate_summary_report(db, current_user, days)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate report")


@router.get("/reports/harvest")
async def generate_harvest_report(
    days: int = 30,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate harvest-focused PDF report"""
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
        
        buffer, filename = ReportGenerationService.generate_harvest_report(db, current_user, days)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error generating harvest report: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate harvest report")


@router.post("/ml/train")
async def train_harvest_model(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Train ML models for harvest prediction
    
    Only admin users can trigger training
    
    Returns:
    - Training metrics and results
    """
    # Check admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can train models")
    
    try:
        success, metrics = MLTrainingService.train_harvest_model(db)
        
        if not success:
            raise HTTPException(status_code=400, detail=metrics.get("error", "Training failed"))
        
        return {
            "status": "success",
            "message": "Model training completed successfully",
            "metrics": metrics,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to train model")


@router.get("/ml/metrics")
async def get_ml_metrics(
    version: str = "v2",
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get training metrics for ML models"""
    try:
        metrics = MLTrainingService.get_training_metrics(version)
        
        if not metrics:
            raise HTTPException(status_code=404, detail="Metrics not found for this version")
        
        return {
            "status": "success",
            "version": version,
            "metrics": metrics
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get metrics")


@router.post("/ml/predict-harvest")
async def predict_harvest_with_ml(
    features: dict,
    model_type: str = "random_forest",
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Make harvest prediction using trained ML model
    
    Features expected:
    - quantity_kg
    - quality_grade_numeric (1-4)
    - days_ago
    - field_name_hash
    """
    try:
        # Load model
        model = MLTrainingService.load_model(model_type)
        if not model:
            raise HTTPException(status_code=404, detail=f"Model not found: {model_type}")
        
        # Get feature names
        import json
        feature_path = MLTrainingService.MODEL_DIR / "feature_names_v2.json"
        if not feature_path.exists():
            raise HTTPException(status_code=404, detail="Feature names not found")
        
        with open(feature_path, 'r') as f:
            feature_names = json.load(f)
        
        # Make prediction
        prediction, confidence = MLTrainingService.predict_with_ml_model(
            model, features, feature_names
        )
        
        return {
            "status": "success",
            "prediction": prediction,
            "confidence": confidence,
            "model_used": model_type,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making prediction: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to make prediction")


@router.get("/reports/health")
async def report_health():
    """Health check for reports module"""
    return {
        "status": "healthy",
        "module": "reports",
        "timestamp": datetime.now().isoformat(),
        "features": {
            "pdf_export": True,
            "ml_training": True,
            "model_serving": True
        }
    }
