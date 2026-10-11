"""
Analytics Service
Aggregates harvest, transport, waste and schedule data for the dashboards
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, timedelta
from app.models import Harvest, Transport, Waste, Schedule, User, QualityTarget, AILog
from typing import Dict, List, Optional


def _month_keys(months: int, today: date) -> List[date]:
    """First day of each of the last `months` months, oldest first"""
    keys = []
    year, month = today.year, today.month
    for _ in range(months):
        keys.append(date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(keys))


def _percent(part: float, whole: float) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


class AnalyticsService:
    """Service for dashboard and analytics aggregation"""

    @staticmethod
    def _period_kpis(db: Session, start: date, end: date) -> Dict:
        """Headline numbers for records dated start <= d <= end"""
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= start, Harvest.harvest_date <= end).all()
        waste = db.query(Waste).filter(Waste.waste_date >= start, Waste.waste_date <= end).all()
        delivered = db.query(Transport).filter(
            Transport.status == "delivered",
            Transport.actual_delivery.isnot(None),
            Transport.scheduled_date >= start,
            Transport.scheduled_date <= end,
        ).all()

        total_kg = sum(h.quantity_kg for h in harvests)
        waste_kg = sum(w.quantity_kg for w in waste)
        delays = [(t.actual_delivery - t.scheduled_date).days for t in delivered]

        return {
            "harvest_volume_kg": round(total_kg, 1),
            "harvest_batches": len(harvests),
            "avg_batch_kg": round(total_kg / len(harvests), 1) if harvests else 0.0,
            "grade_a_percent": _percent(sum(1 for h in harvests if h.quality_grade == "A"), len(harvests)),
            "waste_kg": round(waste_kg, 1),
            "waste_rate_percent": _percent(waste_kg, total_kg),
            "on_time_rate_percent": _percent(sum(1 for d in delays if d <= 0), len(delays)),
            "avg_delivery_delay_days": round(sum(max(d, 0) for d in delays) / len(delays), 1) if delays else 0.0,
        }

    @staticmethod
    def _alerts(db: Session, today: date, current: Dict) -> List[Dict]:
        """Things the farm manager should look at now, most serious first"""
        alerts: List[Dict] = []
        target = db.query(QualityTarget).first()
        max_spoilage = target.max_spoilage_rate if target else 5.0
        max_rejection = target.max_rejection_rate if target else 5.0

        overdue_transports = db.query(Transport).filter(
            Transport.status.in_(["pending", "in_transit"]),
            Transport.scheduled_date < today,
        ).count()
        if overdue_transports:
            alerts.append({
                "level": "warning",
                "msg": f"{overdue_transports} delivery(ies) are past their scheduled date and not delivered",
                "link": "/transport",
            })

        overdue_tasks = db.query(Schedule).filter(
            Schedule.status.in_(["pending", "in_progress"]),
            Schedule.assigned_date < today,
        ).count()
        if overdue_tasks:
            alerts.append({
                "level": "warning",
                "msg": f"{overdue_tasks} scheduled task(s) are overdue",
                "link": "/schedule",
            })

        since = today - timedelta(days=30)
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= since).all()
        total_kg = sum(h.quantity_kg for h in harvests)
        spoilage_rate = _percent(sum(h.spoilage_kg or 0 for h in harvests), total_kg)
        rejection_rate = _percent(sum(h.rejected_kg or 0 for h in harvests), total_kg)
        if spoilage_rate > max_spoilage:
            alerts.append({
                "level": "warning",
                "msg": f"Spoilage rate is {spoilage_rate}% over the last 30 days (target {max_spoilage:g}%)",
                "link": "/harvest",
            })
        if rejection_rate > max_rejection:
            alerts.append({
                "level": "warning",
                "msg": f"Rejection rate is {rejection_rate}% over the last 30 days (target {max_rejection:g}%)",
                "link": "/harvest",
            })

        pending_grading = sum(1 for h in harvests if h.harvest_status == "pending")
        if pending_grading:
            alerts.append({
                "level": "info",
                "msg": f"{pending_grading} harvest batch(es) are waiting to be graded",
                "link": "/harvest",
            })

        in_transit = db.query(Transport).filter(Transport.status == "in_transit").count()
        if in_transit:
            alerts.append({
                "level": "info",
                "msg": f"{in_transit} delivery(ies) currently in transit",
                "link": "/transport",
            })

        if not any(a["level"] == "warning" for a in alerts):
            alerts.append({
                "level": "success",
                "msg": "No overdue deliveries or tasks, and losses are within target",
                "link": None,
            })

        return alerts

    @staticmethod
    def get_overview(db: Session, months: int = 6) -> Dict:
        """
        Everything the admin dashboard and analytics page show

        Args:
            db: Database session
            months: How many calendar months the trend charts cover

        Returns:
            Dictionary with KPIs (last 30 days vs the 30 days before), chart series,
            worker performance, recent harvests and alerts
        """
        today = date.today()
        month_starts = _month_keys(months, today)
        trend_start = month_starts[0]

        current = AnalyticsService._period_kpis(db, today - timedelta(days=29), today)
        previous = AnalyticsService._period_kpis(db, today - timedelta(days=59), today - timedelta(days=30))

        # Monthly series are grouped in Python so the same code runs on SQLite and PostgreSQL
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= trend_start).all()
        transports = db.query(Transport).filter(Transport.scheduled_date >= trend_start).all()
        waste = db.query(Waste).filter(Waste.waste_date >= trend_start).all()

        harvest_by_month = {m: {"kg": 0.0, "batches": 0} for m in month_starts}
        grades: Dict[str, int] = {}
        for h in harvests:
            bucket = harvest_by_month.get(h.harvest_date.replace(day=1))
            if bucket is not None:
                bucket["kg"] += h.quantity_kg
                bucket["batches"] += 1
            grade = h.quality_grade or "ungraded"
            grades[grade] = grades.get(grade, 0) + 1

        transport_by_month = {m: {"delivered": 0, "delayed": 0} for m in month_starts}
        for t in transports:
            bucket = transport_by_month.get(t.scheduled_date.replace(day=1))
            if bucket is None or t.status == "cancelled":
                continue
            if t.status == "delivered" and t.actual_delivery:
                if t.actual_delivery > t.scheduled_date:
                    bucket["delayed"] += 1
                else:
                    bucket["delivered"] += 1
            elif t.scheduled_date < today:
                # Not delivered and already past its date
                bucket["delayed"] += 1

        waste_by_type: Dict[str, float] = {}
        for w in waste:
            waste_by_type[w.waste_type] = waste_by_type.get(w.waste_type, 0) + w.quantity_kg

        users = {u.id: u for u in db.query(User).all()}

        def display_name(user_id: Optional[int]) -> str:
            user = users.get(user_id)
            return (user.full_name or user.username) if user else "-"

        tasks: Dict[int, Dict] = {}
        for s in db.query(Schedule).filter(Schedule.assigned_date >= trend_start, Schedule.status != "cancelled").all():
            row = tasks.setdefault(s.worker_id, {"tasks": 0, "completed": 0})
            row["tasks"] += 1
            if s.status == "completed":
                row["completed"] += 1

        recent = db.query(Harvest).order_by(desc(Harvest.harvest_date), desc(Harvest.id)).limit(5).all()

        active_workers = [u for u in users.values() if u.role == "worker" and u.is_active]
        on_field_today = {
            s.worker_id for s in db.query(Schedule).filter(
                Schedule.assigned_date == today, Schedule.status != "cancelled"
            ).all()
        }

        ai_logs = db.query(AILog).all()
        ai_month = [l for l in ai_logs if l.created_at and l.created_at.date() >= today.replace(day=1)]

        total_graded = sum(grades.values())

        return {
            "generated_at": today,
            "kpis": {"current": current, "previous": previous, "period_days": 30},
            "harvest_trend": [
                {"month": m.strftime("%b"), "kg": round(v["kg"], 1), "batches": v["batches"]}
                for m, v in harvest_by_month.items()
            ],
            "grade_distribution": [
                {"grade": g, "count": c, "percent": _percent(c, total_graded)}
                for g, c in sorted(grades.items())
            ],
            "waste_by_type": [
                {"type": t, "kg": round(kg, 1)}
                for t, kg in sorted(waste_by_type.items(), key=lambda kv: -kv[1])
            ],
            "transport_trend": [
                {"month": m.strftime("%b"), **v} for m, v in transport_by_month.items()
            ],
            "worker_performance": [
                {"worker_id": wid, "name": display_name(wid), **row}
                for wid, row in sorted(tasks.items(), key=lambda kv: -kv[1]["tasks"])
            ][:8],
            "recent_harvests": [
                {
                    "id": h.id,
                    "batch_number": h.batch_number,
                    "field": h.field_name,
                    "date": h.harvest_date,
                    "kg": h.quantity_kg,
                    "grade": h.quality_grade or "ungraded",
                    "worker": display_name(h.user_id),
                }
                for h in recent
            ],
            "alerts": AnalyticsService._alerts(db, today, current),
            "workers": {
                "active": len(active_workers),
                "on_field_today": len(on_field_today & {u.id for u in active_workers}),
            },
            "ai": {
                "total_predictions": len(ai_logs),
                "predictions_this_month": len(ai_month),
                "average_confidence": round(
                    sum(l.confidence_score or 0 for l in ai_logs) / len(ai_logs), 3
                ) if ai_logs else 0,
            },
        }

    @staticmethod
    def get_user_stats(db: Session, user: User) -> Dict:
        """A worker's own activity totals, shown on their profile"""
        today = date.today()
        month_start = today.replace(day=1)

        harvests = db.query(Harvest).filter(Harvest.user_id == user.id).all()
        waste = db.query(Waste).filter(Waste.user_id == user.id).all()
        deliveries = db.query(Transport).filter(Transport.driver_id == user.id).all()
        tasks = db.query(Schedule).filter(Schedule.worker_id == user.id).all()

        delivered = [t for t in deliveries if t.status == "delivered" and t.actual_delivery]

        return {
            "member_since": user.created_at,
            "harvest_count": len(harvests),
            "harvest_kg_total": round(sum(h.quantity_kg for h in harvests), 1),
            "harvest_kg_this_month": round(sum(h.quantity_kg for h in harvests if h.harvest_date >= month_start), 1),
            "waste_count": len(waste),
            "waste_kg_this_month": round(sum(w.quantity_kg for w in waste if w.waste_date >= month_start), 1),
            "transport_count": len(deliveries),
            "deliveries_completed": len(delivered),
            "deliveries_on_time": sum(1 for t in delivered if t.actual_delivery <= t.scheduled_date),
            "tasks_total": len(tasks),
            "tasks_completed": sum(1 for t in tasks if t.status == "completed"),
        }
