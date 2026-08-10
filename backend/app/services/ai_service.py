"""
AI Recommendation Engine Service
Handles ML predictions for harvest, transport priority, and waste classification
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from app.models import AILog, Harvest
from app.schemas import AILogCreate
from typing import Optional, Dict, Tuple
import json


class AIService:
    """Service for AI/ML recommendation operations"""
    
    # Model versions
    SUPPORTED_MODELS = ["v1.0", "v1.1", "v2.0"]
    PREDICTION_TYPES = ["harvest_timing", "quality_prediction", "transport_priority", "waste_classification"]
    
    @staticmethod
    def create_ai_log(
        db: Session,
        ai_data: AILogCreate,
        user_id: int
    ) -> AILog:
        """
        Create AI prediction log
        
        Args:
            db: Database session
            ai_data: AI log data
            user_id: User who triggered the prediction
            
        Returns:
            Created AILog object
        """
        ai_log = AILog(
            user_id=user_id,
            harvest_id=ai_data.harvest_id,
            prediction_type=ai_data.prediction_type,
            input_data=json.dumps(ai_data.input_data),
            prediction_result=ai_data.prediction_result,
            confidence_score=ai_data.confidence_score,
            model_version=ai_data.model_version
        )
        db.add(ai_log)
        db.commit()
        db.refresh(ai_log)
        return ai_log
    
    @staticmethod
    def get_ai_log_by_id(db: Session, log_id: int) -> Optional[AILog]:
        """Get AI log record by ID"""
        return db.query(AILog).filter(AILog.id == log_id).first()
    
    @staticmethod
    def list_ai_logs(
        db: Session,
        prediction_type: Optional[str] = None,
        model_version: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[list, int]:
        """
        List AI prediction logs
        
        Args:
            db: Database session
            prediction_type: Optional prediction type filter
            model_version: Optional model version filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Tuple of (logs list, total count)
        """
        query = db.query(AILog)
        
        if prediction_type:
            query = query.filter(AILog.prediction_type == prediction_type)
        
        if model_version:
            query = query.filter(AILog.model_version == model_version)
        
        total = query.count()
        logs = query.order_by(desc(AILog.created_at)).offset(skip).limit(limit).all()
        
        return logs, total
    
    @staticmethod
    def predict_harvest_timing(
        db: Session,
        harvest_id: int,
        ripeness_level: float,
        days_since_last_harvest: int,
        field_condition_score: float
    ) -> Dict:
        """
        Predict if pineapple should be harvested now
        
        Args:
            db: Database session
            harvest_id: Harvest ID
            ripeness_level: Ripeness level (0-10)
            days_since_last_harvest: Days since last harvest
            field_condition_score: Field condition score (0-10)
            
        Returns:
            Dictionary with recommendation
        """
        # Simple rule-based model (in production, use actual ML model)
        score = 0
        
        # Ripeness factor (most important)
        if ripeness_level >= 7:
            score += 40
        elif ripeness_level >= 5:
            score += 25
        elif ripeness_level >= 3:
            score += 10
        
        # Days since harvest factor
        if days_since_last_harvest >= 30:
            score += 35
        elif days_since_last_harvest >= 20:
            score += 25
        elif days_since_last_harvest >= 10:
            score += 15
        
        # Field condition factor
        if field_condition_score >= 7:
            score += 25
        elif field_condition_score >= 5:
            score += 15
        
        confidence = min(score / 100, 1.0)
        
        if score >= 75:
            recommendation = "Harvest Now"
            quality = "High"
            priority = "Urgent"
        elif score >= 50:
            recommendation = "Harvest Within 2-3 Days"
            quality = "Medium"
            priority = "High"
        else:
            recommendation = "Wait 5+ Days"
            quality = "Low"
            priority = "Normal"
        
        return {
            "recommendation": recommendation,
            "quality_prediction": quality,
            "transport_priority": priority,
            "confidence_score": round(confidence, 3),
            "reasoning": {
                "ripeness_level": ripeness_level,
                "days_since_harvest": days_since_last_harvest,
                "field_condition": field_condition_score,
                "total_score": score
            }
        }
    
    @staticmethod
    def predict_waste_classification(
        db: Session,
        quality_grade: str,
        damage_level: float,
        age_days: int
    ) -> Dict:
        """
        Classify waste type
        
        Args:
            db: Database session
            quality_grade: Quality grade (A, B, C, D)
            damage_level: Damage level (0-10)
            age_days: Age of produce in days
            
        Returns:
            Dictionary with waste classification
        """
        waste_type = "other"
        disposal_method = "discard"
        confidence = 0.5
        
        # Rule-based classification
        if age_days > 14:
            waste_type = "rotten"
            disposal_method = "compost"
            confidence = 0.95
        elif damage_level > 7:
            waste_type = "damaged"
            disposal_method = "compost"
            confidence = 0.9
        elif quality_grade in ["C", "D"]:
            waste_type = "damaged"
            disposal_method = "compost"
            confidence = 0.8
        else:
            waste_type = "unused_parts"
            disposal_method = "donate"
            confidence = 0.7
        
        return {
            "waste_type": waste_type,
            "disposal_method": disposal_method,
            "confidence_score": confidence,
            "quality_grade": quality_grade,
            "damage_level": damage_level,
            "age_days": age_days
        }
    
    @staticmethod
    def get_ai_metrics(db: Session) -> Dict:
        """Get AI model performance metrics"""
        logs = db.query(AILog).all()
        
        if not logs:
            return {
                "total_predictions": 0,
                "average_confidence": 0,
                "by_type": {},
                "by_model_version": {}
            }
        
        by_type = {}
        by_model = {}
        total_confidence = 0
        
        for log in logs:
            # Count by type
            by_type[log.prediction_type] = by_type.get(log.prediction_type, 0) + 1
            
            # Count by model
            by_model[log.model_version] = by_model.get(log.model_version, 0) + 1
            
            # Sum confidence
            total_confidence += log.confidence_score
        
        avg_confidence = total_confidence / len(logs) if logs else 0
        
        return {
            "total_predictions": len(logs),
            "average_confidence": round(avg_confidence, 3),
            "by_prediction_type": by_type,
            "by_model_version": by_model
        }
    
    @staticmethod
    def validate_harvest_prediction_input(
        ripeness_level: float,
        days_since_last_harvest: int,
        field_condition_score: float
    ) -> Tuple[bool, Optional[str]]:
        """Validate harvest prediction input data"""
        if not (0 <= ripeness_level <= 10):
            return False, "Ripeness level must be between 0 and 10"
        
        if days_since_last_harvest < 0:
            return False, "Days since last harvest cannot be negative"
        
        if not (0 <= field_condition_score <= 10):
            return False, "Field condition score must be between 0 and 10"
        
        return True, None
    
    @staticmethod
    def validate_waste_prediction_input(
        quality_grade: str,
        damage_level: float,
        age_days: int
    ) -> Tuple[bool, Optional[str]]:
        """Validate waste prediction input data"""
        valid_grades = ["A", "B", "C", "D"]
        if quality_grade not in valid_grades:
            return False, f"Quality grade must be one of: {', '.join(valid_grades)}"
        
        if not (0 <= damage_level <= 10):
            return False, "Damage level must be between 0 and 10"
        
        if age_days < 0:
            return False, "Age cannot be negative"
        
        return True, None
