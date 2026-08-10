"""
ML Model Training Service
Trains Decision Tree and Random Forest models for harvest prediction
Uses historical harvest data to improve AI recommendations
"""

import pickle
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sqlalchemy.orm import Session
from app.models import Harvest, Transport, Waste
import logging

logger = logging.getLogger(__name__)

class MLTrainingService:
    """Service for training and managing ML models"""
    
    MODEL_DIR = Path("backend/app/models")
    
    @classmethod
    def ensure_model_dir(cls):
        """Ensure model directory exists"""
        cls.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def prepare_harvest_dataset(db: Session) -> Tuple[pd.DataFrame, Optional[str]]:
        """
        Prepare dataset from harvest records for model training
        
        Features:
        - ripeness_level: 0-10
        - days_since_last_harvest: days
        - field_condition_score: 0-10
        - temperature: celsius (if available)
        - humidity: percentage (if available)
        
        Target:
        - optimal_harvest: 1 if harvested successfully, 0 otherwise
        """
        try:
            # Query harvests with related data
            harvests = db.query(Harvest).all()
            
            if len(harvests) < 10:
                return None, "Insufficient data: need at least 10 harvest records"
            
            data = []
            for harvest in harvests:
                # Extract features from harvest record
                entry = {
                    'quantity_kg': harvest.quantity_kg or 50,
                    'quality_grade_numeric': {'A': 4, 'B': 3, 'C': 2, 'D': 1}.get(harvest.quality_grade, 2),
                    'days_ago': (datetime.now() - harvest.harvest_date).days if harvest.harvest_date else 0,
                    'field_name_hash': hash(harvest.field_name) % 100,
                }
                
                # Target: was this a good harvest? (Grade A-B = 1, C-D = 0)
                is_good = 1 if harvest.quality_grade in ['A', 'B'] else 0
                entry['optimal_harvest'] = is_good
                
                data.append(entry)
            
            df = pd.DataFrame(data)
            
            # Handle missing values
            df = df.fillna(df.mean(numeric_only=True))
            
            logger.info(f"Prepared dataset with {len(df)} records")
            return df, None
            
        except Exception as e:
            logger.error(f"Error preparing dataset: {str(e)}")
            return None, f"Error preparing dataset: {str(e)}"
    
    @classmethod
    def train_harvest_model(cls, db: Session) -> Tuple[bool, Dict]:
        """
        Train Decision Tree and Random Forest models for harvest prediction
        
        Returns:
            Tuple of (success: bool, metrics: dict)
        """
        cls.ensure_model_dir()
        
        try:
            # Prepare dataset
            df, error = cls.prepare_harvest_dataset(db)
            if error:
                return False, {"error": error, "timestamp": datetime.now().isoformat()}
            
            if df is None:
                return False, {"error": "No data available for training"}
            
            # Separate features and target
            X = df.drop('optimal_harvest', axis=1)
            y = df['optimal_harvest']
            
            # Split data (80/20)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            models = {}
            metrics = {
                "timestamp": datetime.now().isoformat(),
                "dataset_size": len(df),
                "train_size": len(X_train),
                "test_size": len(X_test),
                "models": {}
            }
            
            # Train Decision Tree
            dt_model = DecisionTreeClassifier(max_depth=5, random_state=42)
            dt_model.fit(X_train, y_train)
            dt_pred = dt_model.predict(X_test)
            
            dt_metrics = {
                "accuracy": float(accuracy_score(y_test, dt_pred)),
                "precision": float(precision_score(y_test, dt_pred, zero_division=0)),
                "recall": float(recall_score(y_test, dt_pred, zero_division=0)),
                "f1": float(f1_score(y_test, dt_pred, zero_division=0))
            }
            metrics["models"]["decision_tree"] = dt_metrics
            models["decision_tree"] = dt_model
            
            # Train Random Forest
            rf_model = RandomForestClassifier(n_estimators=10, max_depth=5, random_state=42)
            rf_model.fit(X_train, y_train)
            rf_pred = rf_model.predict(X_test)
            
            rf_metrics = {
                "accuracy": float(accuracy_score(y_test, rf_pred)),
                "precision": float(precision_score(y_test, rf_pred, zero_division=0)),
                "recall": float(recall_score(y_test, rf_pred, zero_division=0)),
                "f1": float(f1_score(y_test, rf_pred, zero_division=0))
            }
            metrics["models"]["random_forest"] = rf_metrics
            models["random_forest"] = rf_model
            
            # Save models
            for name, model in models.items():
                model_path = cls.MODEL_DIR / f"{name}_v2.pkl"
                with open(model_path, 'wb') as f:
                    pickle.dump(model, f)
                logger.info(f"Saved {name} model to {model_path}")
            
            # Save feature names for prediction
            feature_path = cls.MODEL_DIR / "feature_names_v2.json"
            with open(feature_path, 'w') as f:
                json.dump(list(X.columns), f)
            
            # Save metrics
            metrics_path = cls.MODEL_DIR / "training_metrics_v2.json"
            with open(metrics_path, 'w') as f:
                json.dump(metrics, f, indent=2)
            
            logger.info("Model training completed successfully")
            return True, metrics
            
        except Exception as e:
            logger.error(f"Error during model training: {str(e)}")
            return False, {"error": f"Training failed: {str(e)}", "timestamp": datetime.now().isoformat()}
    
    @classmethod
    def load_model(cls, model_name: str, version: str = "v2") -> Optional[object]:
        """Load a trained model from disk"""
        try:
            model_path = cls.MODEL_DIR / f"{model_name}_{version}.pkl"
            if not model_path.exists():
                logger.warning(f"Model not found: {model_path}")
                return None
            
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            return model
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return None
    
    @classmethod
    def get_training_metrics(cls, version: str = "v2") -> Optional[Dict]:
        """Get training metrics for a model version"""
        try:
            metrics_path = cls.MODEL_DIR / f"training_metrics_{version}.json"
            if not metrics_path.exists():
                return None
            
            with open(metrics_path, 'r') as f:
                metrics = json.load(f)
            return metrics
        except Exception as e:
            logger.error(f"Error loading metrics: {str(e)}")
            return None
    
    @staticmethod
    def predict_with_ml_model(
        model: object,
        features: Dict,
        feature_names: List[str]
    ) -> Tuple[int, float]:
        """
        Make prediction using trained ML model
        
        Args:
            model: Trained sklearn model
            features: Dictionary of feature values
            feature_names: List of expected feature names
            
        Returns:
            Tuple of (prediction: 0 or 1, confidence: float)
        """
        try:
            # Prepare feature vector in correct order
            feature_vector = np.array([[features.get(name, 0) for name in feature_names]])
            
            # Make prediction
            prediction = model.predict(feature_vector)[0]
            probabilities = model.predict_proba(feature_vector)[0]
            confidence = float(max(probabilities))
            
            return int(prediction), confidence
        except Exception as e:
            logger.error(f"Error in prediction: {str(e)}")
            return 0, 0.5
