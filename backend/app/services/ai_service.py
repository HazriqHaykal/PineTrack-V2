"""
AI Recommendation Engine Service
Uses Google Gemini for harvest timing, waste classification and farm-wide
recommendations. Every prediction has a rule-based fallback, used when no
Gemini API key is configured or the Gemini call fails.
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, timedelta
from app.models import AILog, Harvest, Transport, Waste, Schedule, QualityTarget
from app.schemas import AILogCreate
from app.services.gemini_service import GeminiService, GeminiError
from typing import Optional, Dict, List, Tuple
import json
import logging

logger = logging.getLogger(__name__)

RULES_MODEL = "rules-v1"

HARVEST_RECOMMENDATIONS = ["Harvest Now", "Harvest Within 2-3 Days", "Wait 5+ Days"]
QUALITY_LEVELS = ["High", "Medium", "Low"]
TRANSPORT_PRIORITIES = ["Urgent", "High", "Normal"]
WASTE_TYPES = ["rotten", "damaged", "overripe", "unused_parts", "other"]
DISPOSAL_METHODS = ["compost", "recycle", "discard", "donate", "animal feed"]
RECOMMENDATION_TYPES = ["harvest", "waste", "transport", "schedule"]
RECOMMENDATION_PRIORITIES = ["high", "medium", "low"]

FARM_CONTEXT = (
    "You are PineTrack Agent, the agronomy assistant built into PineTrack, a pineapple post-harvest management "
    "system used on a farm in Malaysia. Base every answer only on the data provided. "
    "Be specific and practical, and keep explanations short."
)


def _clamp(value, low: float, high: float, default: float) -> float:
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return default


class AIService:
    """Service for AI recommendation operations"""

    PREDICTION_TYPES = ["harvest_timing", "waste_classification", "recommendations"]

    # ── Logs ──────────────────────────────────────────────────────────────

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
            input_data=json.dumps(ai_data.input_data, default=str),
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

        Returns:
            Tuple of (logs list, total count)
        """
        query = db.query(AILog)

        if prediction_type:
            query = query.filter(AILog.prediction_type == prediction_type)

        if model_version:
            query = query.filter(AILog.model_version == model_version)

        total = query.count()
        logs = query.order_by(desc(AILog.created_at), desc(AILog.id)).offset(skip).limit(limit).all()

        return logs, total

    @staticmethod
    def get_status() -> Dict:
        """Which engine currently answers AI requests"""
        configured = GeminiService.is_configured()
        return {
            "provider": "gemini" if configured else "rules",
            "model": GeminiService.model_label() if configured else RULES_MODEL,
            "gemini_configured": configured,
        }

    # ── Harvest timing ────────────────────────────────────────────────────

    @staticmethod
    def _harvest_timing_rules(
        ripeness_level: float,
        days_since_last_harvest: int,
        field_condition_score: float
    ) -> Dict:
        """Score-based harvest timing recommendation"""
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

        if score >= 75:
            recommendation, quality, priority = "Harvest Now", "High", "Urgent"
        elif score >= 50:
            recommendation, quality, priority = "Harvest Within 2-3 Days", "Medium", "High"
        else:
            recommendation, quality, priority = "Wait 5+ Days", "Low", "Normal"

        return {
            "recommendation": recommendation,
            "quality_prediction": quality,
            "transport_priority": priority,
            "confidence_score": round(min(score / 100, 1.0), 3),
            "total_score": score,
            "explanation": (
                f"Ripeness {ripeness_level:g}/10, {days_since_last_harvest} days since the last harvest "
                f"and field condition {field_condition_score:g}/10 give a readiness score of {score}/100."
            ),
        }

    @staticmethod
    def predict_harvest_timing(
        db: Session,
        harvest_id: int,
        ripeness_level: float,
        days_since_last_harvest: int,
        field_condition_score: float
    ) -> Dict:
        """
        Recommend when a pineapple batch should be harvested

        Args:
            db: Database session
            harvest_id: Harvest ID
            ripeness_level: Ripeness level (0-10)
            days_since_last_harvest: Days since last harvest
            field_condition_score: Field condition score (0-10)

        Returns:
            Dictionary with recommendation, confidence and the engine that produced it
        """
        rules = AIService._harvest_timing_rules(ripeness_level, days_since_last_harvest, field_condition_score)
        result = {**rules, "source": "rules", "model_version": RULES_MODEL}

        if GeminiService.is_configured():
            harvest = db.query(Harvest).filter(Harvest.id == harvest_id).first()
            batch = {
                "field_name": harvest.field_name,
                "harvest_date": str(harvest.harvest_date),
                "quantity_kg": harvest.quantity_kg,
                "quality_grade": harvest.quality_grade,
            } if harvest else {}
            prompt = (
                f"{FARM_CONTEXT}\n\n"
                "Decide when this pineapple block should be harvested.\n"
                f"Batch: {json.dumps(batch)}\n"
                f"Ripeness level (0-10): {ripeness_level}\n"
                f"Days since the last harvest of this block: {days_since_last_harvest}\n"
                f"Field condition score (0-10): {field_condition_score}\n\n"
                "Return the harvest recommendation, the expected fruit quality, how urgently transport "
                "should be arranged, your confidence between 0 and 1, and a one or two sentence explanation."
            )
            schema = {
                "type": "OBJECT",
                "properties": {
                    "recommendation": {"type": "STRING", "enum": HARVEST_RECOMMENDATIONS},
                    "quality_prediction": {"type": "STRING", "enum": QUALITY_LEVELS},
                    "transport_priority": {"type": "STRING", "enum": TRANSPORT_PRIORITIES},
                    "confidence_score": {"type": "NUMBER"},
                    "explanation": {"type": "STRING"},
                },
                "required": ["recommendation", "quality_prediction", "transport_priority", "confidence_score", "explanation"],
            }
            try:
                answer = GeminiService.generate_json(prompt, schema)
                if (
                    answer.get("recommendation") in HARVEST_RECOMMENDATIONS
                    and answer.get("quality_prediction") in QUALITY_LEVELS
                    and answer.get("transport_priority") in TRANSPORT_PRIORITIES
                ):
                    result.update({
                        "recommendation": answer["recommendation"],
                        "quality_prediction": answer["quality_prediction"],
                        "transport_priority": answer["transport_priority"],
                        "confidence_score": round(_clamp(answer.get("confidence_score"), 0, 1, rules["confidence_score"]), 3),
                        "explanation": str(answer.get("explanation") or rules["explanation"]),
                        "source": "gemini",
                        "model_version": GeminiService.model_label(),
                    })
                else:
                    logger.warning("Gemini harvest answer had unexpected values; using rules")
            except (GeminiError, AttributeError) as e:
                logger.warning(f"Gemini harvest prediction failed, using rules: {e}")

        total_score = result.pop("total_score")
        result["reasoning"] = {
            "ripeness_level": ripeness_level,
            "days_since_harvest": days_since_last_harvest,
            "field_condition": field_condition_score,
            "total_score": total_score,
        }
        return result

    # ── Waste classification ──────────────────────────────────────────────

    @staticmethod
    def _waste_classification_rules(quality_grade: str, damage_level: float, age_days: int) -> Dict:
        """Rule-based waste classification"""
        if age_days > 14:
            waste_type, disposal_method, confidence = "rotten", "compost", 0.95
            why = f"The produce is {age_days} days old, past the point where it can be sold or donated."
        elif damage_level > 7:
            waste_type, disposal_method, confidence = "damaged", "compost", 0.9
            why = f"A damage level of {damage_level:g}/10 makes it unsuitable for sale."
        elif quality_grade in ["C", "D"]:
            waste_type, disposal_method, confidence = "damaged", "compost", 0.8
            why = f"Grade {quality_grade} produce with visible defects is best composted."
        else:
            waste_type, disposal_method, confidence = "unused_parts", "donate", 0.7
            why = "The produce is still fresh and lightly damaged, so the usable parts can be donated."

        return {
            "waste_type": waste_type,
            "disposal_method": disposal_method,
            "confidence_score": confidence,
            "explanation": why,
        }

    @staticmethod
    def predict_waste_classification(
        db: Session,
        quality_grade: str,
        damage_level: float,
        age_days: int
    ) -> Dict:
        """
        Classify waste and recommend a disposal method

        Args:
            db: Database session
            quality_grade: Quality grade (A, B, C, D)
            damage_level: Damage level (0-10)
            age_days: Age of produce in days

        Returns:
            Dictionary with waste classification and the engine that produced it
        """
        result = {
            **AIService._waste_classification_rules(quality_grade, damage_level, age_days),
            "source": "rules",
            "model_version": RULES_MODEL,
        }

        if GeminiService.is_configured():
            prompt = (
                f"{FARM_CONTEXT}\n\n"
                "Classify this rejected pineapple produce and choose the best disposal method.\n"
                f"Quality grade (A best, D worst): {quality_grade}\n"
                f"Damage level (0-10): {damage_level}\n"
                f"Age in days since harvest: {age_days}\n\n"
                "Return the waste type, the disposal method, your confidence between 0 and 1, "
                "and a one or two sentence explanation."
            )
            schema = {
                "type": "OBJECT",
                "properties": {
                    "waste_type": {"type": "STRING", "enum": WASTE_TYPES},
                    "disposal_method": {"type": "STRING", "enum": DISPOSAL_METHODS},
                    "confidence_score": {"type": "NUMBER"},
                    "explanation": {"type": "STRING"},
                },
                "required": ["waste_type", "disposal_method", "confidence_score", "explanation"],
            }
            try:
                answer = GeminiService.generate_json(prompt, schema)
                if answer.get("waste_type") in WASTE_TYPES and answer.get("disposal_method") in DISPOSAL_METHODS:
                    result.update({
                        "waste_type": answer["waste_type"],
                        "disposal_method": answer["disposal_method"],
                        "confidence_score": round(_clamp(answer.get("confidence_score"), 0, 1, result["confidence_score"]), 3),
                        "explanation": str(answer.get("explanation") or result["explanation"]),
                        "source": "gemini",
                        "model_version": GeminiService.model_label(),
                    })
                else:
                    logger.warning("Gemini waste answer had unexpected values; using rules")
            except (GeminiError, AttributeError) as e:
                logger.warning(f"Gemini waste classification failed, using rules: {e}")

        result.update({
            "quality_grade": quality_grade,
            "damage_level": damage_level,
            "age_days": age_days,
        })
        return result

    # ── Farm-wide recommendations ─────────────────────────────────────────

    @staticmethod
    def build_farm_snapshot(db: Session, days: int = 30) -> Dict:
        """Summarise recent operations; this is the only data the AI sees"""
        today = date.today()
        since = today - timedelta(days=days)

        target = db.query(QualityTarget).first()
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= since).all()
        waste = db.query(Waste).filter(Waste.waste_date >= since).all()
        transports = db.query(Transport).filter(Transport.scheduled_date >= since).all()
        schedules = db.query(Schedule).filter(Schedule.assigned_date >= since).all()

        total_kg = sum(h.quantity_kg for h in harvests)
        spoilage_kg = sum(h.spoilage_kg or 0 for h in harvests)
        rejected_kg = sum(h.rejected_kg or 0 for h in harvests)

        fields: Dict[str, Dict] = {}
        grades: Dict[str, int] = {}
        for h in harvests:
            f = fields.setdefault(h.field_name, {"batches": 0, "kg": 0.0, "spoilage_kg": 0.0, "rejected_kg": 0.0, "ripeness": []})
            f["batches"] += 1
            f["kg"] += h.quantity_kg
            f["spoilage_kg"] += h.spoilage_kg or 0
            f["rejected_kg"] += h.rejected_kg or 0
            if h.ripeness_level is not None:
                f["ripeness"].append(h.ripeness_level)
            grade = h.quality_grade or "ungraded"
            grades[grade] = grades.get(grade, 0) + 1

        field_rows = []
        for name, f in sorted(fields.items()):
            field_rows.append({
                "field": name,
                "batches": f["batches"],
                "kg": round(f["kg"], 1),
                "loss_rate_percent": round((f["spoilage_kg"] + f["rejected_kg"]) / f["kg"] * 100, 1) if f["kg"] else 0.0,
                "avg_ripeness": round(sum(f["ripeness"]) / len(f["ripeness"]), 1) if f["ripeness"] else None,
            })

        waste_by_type: Dict[str, float] = {}
        for w in waste:
            waste_by_type[w.waste_type] = round(waste_by_type.get(w.waste_type, 0) + w.quantity_kg, 1)
        waste_kg = sum(w.quantity_kg for w in waste)

        open_transports = [t for t in transports if t.status in ("pending", "in_transit")]
        delivered = [t for t in transports if t.status == "delivered" and t.actual_delivery]
        late = [t for t in delivered if t.actual_delivery > t.scheduled_date]

        open_tasks = [s for s in schedules if s.status in ("pending", "in_progress")]

        return {
            "period_days": days,
            "date": str(today),
            "targets": {
                "max_spoilage_rate_percent": target.max_spoilage_rate if target else 5.0,
                "max_rejection_rate_percent": target.max_rejection_rate if target else 5.0,
            },
            "harvest": {
                "batches": len(harvests),
                "total_kg": round(total_kg, 1),
                "spoilage_rate_percent": round(spoilage_kg / total_kg * 100, 1) if total_kg else 0.0,
                "rejection_rate_percent": round(rejected_kg / total_kg * 100, 1) if total_kg else 0.0,
                "grade_counts": grades,
                "ungraded_pending_batches": sum(1 for h in harvests if h.harvest_status == "pending"),
                "by_field": field_rows,
            },
            "waste": {
                "records": len(waste),
                "total_kg": round(waste_kg, 1),
                "waste_rate_percent": round(waste_kg / total_kg * 100, 1) if total_kg else 0.0,
                "by_type_kg": waste_by_type,
            },
            "transport": {
                "total": len(transports),
                "pending": sum(1 for t in transports if t.status == "pending"),
                "in_transit": sum(1 for t in transports if t.status == "in_transit"),
                "delivered": len(delivered),
                "delivered_late": len(late),
                "overdue_not_delivered": [
                    {"destination": t.destination, "scheduled_date": str(t.scheduled_date), "status": t.status}
                    for t in open_transports if t.scheduled_date < today
                ],
            },
            "tasks": {
                "open": len(open_tasks),
                "overdue": sum(1 for s in open_tasks if s.assigned_date < today),
                "high_priority_open": sum(1 for s in open_tasks if s.priority == "high"),
                "completed": sum(1 for s in schedules if s.status == "completed"),
            },
        }

    @staticmethod
    def _recommendation_rules(snapshot: Dict) -> List[Dict]:
        """Recommendations derived directly from thresholds in the snapshot"""
        recs: List[Dict] = []
        harvest, waste, transport, tasks = snapshot["harvest"], snapshot["waste"], snapshot["transport"], snapshot["tasks"]
        targets = snapshot["targets"]

        if harvest["batches"] == 0:
            return [{
                "type": "harvest", "priority": "low", "title": "No recent harvest data",
                "description": f"No harvests were recorded in the last {snapshot['period_days']} days, so there is nothing to analyse yet.",
                "confidence": 90, "impact": "Enables recommendations", "action": "Log harvest batches",
            }]

        if harvest["spoilage_rate_percent"] > targets["max_spoilage_rate_percent"]:
            recs.append({
                "type": "waste", "priority": "high", "title": "Spoilage rate is above target",
                "description": (
                    f"Spoilage is {harvest['spoilage_rate_percent']}% of harvested weight against a target of "
                    f"{targets['max_spoilage_rate_percent']}%. Harvest slightly earlier and shorten the time between picking and cold storage."
                ),
                "confidence": 85,
                "impact": f"-{round(harvest['spoilage_rate_percent'] - targets['max_spoilage_rate_percent'], 1)}% spoilage to reach target",
                "action": "Review harvest timing",
            })

        if harvest["rejection_rate_percent"] > targets["max_rejection_rate_percent"]:
            recs.append({
                "type": "harvest", "priority": "high", "title": "Rejection rate is above target",
                "description": (
                    f"{harvest['rejection_rate_percent']}% of harvested weight was rejected against a target of "
                    f"{targets['max_rejection_rate_percent']}%. Check grading on the fields with the highest losses."
                ),
                "confidence": 82, "impact": "Higher marketable yield", "action": "Inspect grading process",
            })

        worst = max(harvest["by_field"], key=lambda f: f["loss_rate_percent"], default=None)
        if worst and worst["loss_rate_percent"] > targets["max_spoilage_rate_percent"] + targets["max_rejection_rate_percent"]:
            recs.append({
                "type": "harvest", "priority": "medium", "title": f"High losses in {worst['field']}",
                "description": (
                    f"{worst['field']} lost {worst['loss_rate_percent']}% of its {worst['kg']} kg to spoilage and rejection, "
                    "the highest of any field. Schedule an inspection before the next harvest there."
                ),
                "confidence": 78, "impact": "Fewer rejected batches", "action": f"Inspect {worst['field']}",
            })

        overdue = transport["overdue_not_delivered"]
        if overdue:
            recs.append({
                "type": "transport", "priority": "high", "title": f"{len(overdue)} delivery(ies) overdue",
                "description": (
                    "These deliveries are past their scheduled date and not marked delivered: "
                    + ", ".join(f"{t['destination']} ({t['scheduled_date']})" for t in overdue[:3]) + "."
                ),
                "confidence": 95, "impact": "Avoid fruit quality loss in transit", "action": "Follow up with drivers",
            })
        elif transport["delivered"] and transport["delivered_late"] / transport["delivered"] > 0.2:
            recs.append({
                "type": "transport", "priority": "medium", "title": "Late deliveries are frequent",
                "description": f"{transport['delivered_late']} of {transport['delivered']} deliveries arrived after their scheduled date.",
                "confidence": 80, "impact": "Better on-time rate", "action": "Review delivery planning",
            })

        if tasks["overdue"]:
            recs.append({
                "type": "schedule", "priority": "medium", "title": f"{tasks['overdue']} task(s) overdue",
                "description": f"{tasks['overdue']} assigned tasks are past their date and still open. Reassign or reschedule them.",
                "confidence": 92, "impact": "Clear the task backlog", "action": "Open scheduling",
            })

        if harvest["ungraded_pending_batches"] >= 3:
            recs.append({
                "type": "harvest", "priority": "low", "title": "Batches waiting to be graded",
                "description": f"{harvest['ungraded_pending_batches']} harvest batches are still pending grading.",
                "confidence": 88, "impact": "Faster dispatch", "action": "Grade pending batches",
            })

        if not recs:
            recs.append({
                "type": "harvest", "priority": "low", "title": "Operations are within targets",
                "description": (
                    f"Spoilage ({harvest['spoilage_rate_percent']}%) and rejection ({harvest['rejection_rate_percent']}%) "
                    "are within target and no deliveries or tasks are overdue."
                ),
                "confidence": 85, "impact": "No action needed", "action": "Keep monitoring",
            })

        return recs

    @staticmethod
    def _recommendation_gemini(snapshot: Dict) -> List[Dict]:
        prompt = (
            f"{FARM_CONTEXT}\n\n"
            f"Here is a summary of the farm's operations for the last {snapshot['period_days']} days:\n"
            f"{json.dumps(snapshot, indent=2)}\n\n"
            "Give between 3 and 5 recommendations for the farm manager, most important first. "
            "Each must be grounded in specific numbers from the summary. For each give: type "
            "(harvest, waste, transport or schedule), priority, a short title, a description of two sentences "
            "at most, your confidence as a whole number from 0 to 100, the expected impact in a few words, "
            "and a short action label for a button."
        )
        schema = {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type": {"type": "STRING", "enum": RECOMMENDATION_TYPES},
                    "priority": {"type": "STRING", "enum": RECOMMENDATION_PRIORITIES},
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "confidence": {"type": "INTEGER"},
                    "impact": {"type": "STRING"},
                    "action": {"type": "STRING"},
                },
                "required": ["type", "priority", "title", "description", "confidence", "impact", "action"],
            },
        }
        answer = GeminiService.generate_json(prompt, schema)
        if not isinstance(answer, list):
            raise GeminiError("Expected a list of recommendations")

        recs = []
        for item in answer[:6]:
            if not isinstance(item, dict) or not item.get("title") or not item.get("description"):
                continue
            recs.append({
                "type": item.get("type") if item.get("type") in RECOMMENDATION_TYPES else "harvest",
                "priority": item.get("priority") if item.get("priority") in RECOMMENDATION_PRIORITIES else "medium",
                "title": str(item["title"]),
                "description": str(item["description"]),
                "confidence": int(_clamp(item.get("confidence"), 0, 100, 70)),
                "impact": str(item.get("impact") or ""),
                "action": str(item.get("action") or "Review"),
            })
        if not recs:
            raise GeminiError("Gemini returned no usable recommendations")
        return recs

    @staticmethod
    def generate_recommendations(db: Session, user_id: int) -> AILog:
        """Generate farm-wide recommendations and store them as an AI log"""
        snapshot = AIService.build_farm_snapshot(db)

        items, source, model = None, "rules", RULES_MODEL
        if GeminiService.is_configured():
            try:
                items = AIService._recommendation_gemini(snapshot)
                source, model = "gemini", GeminiService.model_label()
            except (GeminiError, AttributeError) as e:
                logger.warning(f"Gemini recommendations failed, using rules: {e}")
        if items is None:
            items = AIService._recommendation_rules(snapshot)

        for index, item in enumerate(items, start=1):
            item["id"] = index

        log = AILogCreate(
            harvest_id=None,
            prediction_type="recommendations",
            input_data={"source": source, "items": items, "snapshot": snapshot},
            prediction_result=f"{len(items)} recommendations generated",
            confidence_score=round(sum(i["confidence"] for i in items) / len(items) / 100, 3),
            model_version=model,
        )
        return AIService.create_ai_log(db, log, user_id)

    @staticmethod
    def get_recommendations(db: Session, user_id: int, refresh: bool = False) -> Dict:
        """Return the latest stored recommendations, generating them when missing or on refresh"""
        log = None
        if not refresh:
            log = db.query(AILog).filter(
                AILog.prediction_type == "recommendations"
            ).order_by(desc(AILog.created_at), desc(AILog.id)).first()
        if log is None:
            log = AIService.generate_recommendations(db, user_id)

        data = json.loads(log.input_data)
        return {
            "items": data.get("items", []),
            "source": data.get("source", "rules"),
            "model_version": log.model_version,
            "generated_at": log.created_at,
        }

    # ── Metrics ───────────────────────────────────────────────────────────

    @staticmethod
    def get_ai_metrics(db: Session) -> Dict:
        """Get AI usage metrics"""
        logs = db.query(AILog).all()

        by_type: Dict[str, int] = {}
        by_model: Dict[str, int] = {}
        total_confidence = 0.0

        for log in logs:
            by_type[log.prediction_type] = by_type.get(log.prediction_type, 0) + 1
            by_model[log.model_version] = by_model.get(log.model_version, 0) + 1
            total_confidence += log.confidence_score or 0

        return {
            "total_predictions": len(logs),
            "average_confidence": round(total_confidence / len(logs), 3) if logs else 0,
            "by_prediction_type": by_type,
            "by_model_version": by_model,
        }

    # ── Validation ────────────────────────────────────────────────────────

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
