"""
Read-only Sulur Inventory figures for the shared intelligence features
(PineTrack Agent and Analytics).

Everything here reads the Sulur tables as they are. Nothing is seeded or
written, so an empty module reports as empty instead of showing sample data.
All quantities are sulur pieces (planting material counts), never kilograms,
so they are kept apart from the post-harvest figures.

The recommendation rules mirror the alert rules already used by the Sulur
module's own dashboard summary (routers/sulur.py): low stock against each
variety's min_stock_threshold, raw or curing stock stored too long, and
available stock still awaiting quality certification.
"""

from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import SulurBatch, SulurMovement, SulurPlanRecord, SulurReferenceConfig

UNIT = "sulur pieces"
STORAGE_DAYS_LIMIT = 14          # same limit as the Sulur module's STORAGE_DURATION_WARNING
DEFAULT_MIN_STOCK = 5000         # model default for SulurReferenceConfig.min_stock_threshold
MOVEMENT_TYPES = ["stock_in", "reserve", "release_reserve", "plant", "sell", "stock_out", "damage", "transfer"]


def _month_keys(months: int, today: date) -> List[date]:
    keys, year, month = [], today.year, today.month
    for _ in range(months):
        keys.append(date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(keys))


def _movement_totals(movements: List[SulurMovement]) -> Dict[str, int]:
    totals: Dict[str, int] = {}
    for m in movements:
        totals[m.movement_type] = totals.get(m.movement_type, 0) + (m.quantity or 0)
    return totals


class SulurInsightsService:

    @staticmethod
    def build_snapshot(db: Session, days: int = 30, today: Optional[date] = None) -> Dict:
        """Current Sulur stock position plus the last `days` of movements; the only Sulur data the agent sees"""
        today = today or date.today()
        since = today - timedelta(days=days)

        batches = db.query(SulurBatch).all()
        thresholds = {c.variety: c.min_stock_threshold for c in db.query(SulurReferenceConfig).all()}
        movements = db.query(SulurMovement).filter(SulurMovement.movement_date >= since).all()
        plans = db.query(SulurPlanRecord).order_by(SulurPlanRecord.created_at.desc()).limit(5).all()

        by_variety: Dict[str, Dict] = {}
        for b in batches:
            v = by_variety.setdefault(b.variety, {
                "variety": b.variety, "batches": 0, "available": 0, "reserved": 0,
                "planted": 0, "sold": 0, "damaged": 0,
            })
            v["batches"] += 1
            for key, attr in (("available", "available_quantity"), ("reserved", "reserved_quantity"),
                              ("planted", "planted_quantity"), ("sold", "sold_quantity"), ("damaged", "damaged_quantity")):
                v[key] += getattr(b, attr) or 0
        variety_rows = []
        for name, v in sorted(by_variety.items()):
            threshold = thresholds.get(name, DEFAULT_MIN_STOCK)
            variety_rows.append({**v, "min_stock_threshold": threshold, "below_threshold": v["available"] < threshold})

        aging = []
        for b in batches:
            stored = (today - b.date_received).days if b.date_received else 0
            if (b.available_quantity or 0) > 0 and stored > STORAGE_DAYS_LIMIT and b.treatment_status in ("raw", "curing"):
                aging.append({"batch_code": b.batch_code, "variety": b.variety, "days_stored": stored,
                              "treatment_status": b.treatment_status, "available": b.available_quantity})
        aging.sort(key=lambda a: a["days_stored"], reverse=True)

        uncertified = [
            {"batch_code": b.batch_code, "variety": b.variety, "available": b.available_quantity}
            for b in batches if (b.available_quantity or 0) > 0 and not b.is_certified
        ]

        def total(attr: str) -> int:
            return sum(getattr(b, attr) or 0 for b in batches)

        return {
            "unit": UNIT,
            "period_days": days,
            "date": str(today),
            "storage_days_limit": STORAGE_DAYS_LIMIT,
            "batches": len(batches),
            "certified_batches": sum(1 for b in batches if b.is_certified),
            "totals": {
                "available": total("available_quantity"),
                "reserved": total("reserved_quantity"),
                "planted": total("planted_quantity"),
                "sold": total("sold_quantity"),
                "damaged": total("damaged_quantity"),
            },
            "by_variety": variety_rows,
            "aging_batches": aging[:10],
            "uncertified_batches": uncertified[:10],
            "uncertified_count": len(uncertified),
            "movements_in_period": _movement_totals(movements),
            "plans": {
                "recent": [
                    {"plan_title": p.plan_title, "variety": p.variety, "required_sulur": p.required_sulur,
                     "stock_shortfall": p.stock_shortfall,
                     "created_at": p.created_at.date().isoformat() if p.created_at else None}
                    for p in plans
                ],
            },
        }

    @staticmethod
    def rules(snapshot: Dict) -> List[Dict]:
        """Recommendations from the Sulur module's own alert rules; none when no batches are recorded"""
        if snapshot["batches"] == 0:
            return []
        recs: List[Dict] = []

        for v in snapshot["by_variety"]:
            if v["below_threshold"]:
                empty = v["available"] == 0
                recs.append({
                    "type": "sulur", "priority": "high" if empty else "medium",
                    "title": f"{v['variety']} sulur stock is {'used up' if empty else 'below minimum'}",
                    "description": (
                        f"{v['available']:,} {v['variety']} sulur available against a minimum of "
                        f"{v['min_stock_threshold']:,}. Plan new suckers or procure certified batches before the next planting."
                    ),
                    "confidence": 90, "impact": "Avoid planting delays", "action": "Review sulur stock",
                })

        aging = snapshot["aging_batches"]
        if aging:
            names = ", ".join(f"{a['batch_code']} ({a['days_stored']} days, {a['treatment_status']})" for a in aging[:3])
            recs.append({
                "type": "sulur", "priority": "medium",
                "title": f"{len(aging)} sulur batch(es) stored over {snapshot['storage_days_limit']} days untreated",
                "description": f"Still raw or curing: {names}. Complete treatment and grading, or schedule planting, to limit dehydration.",
                "confidence": 85, "impact": "Less sulur lost in storage", "action": "Open stock & batches",
            })

        if snapshot["uncertified_count"]:
            pieces = sum(u["available"] for u in snapshot["uncertified_batches"])
            recs.append({
                "type": "sulur", "priority": "low",
                "title": f"{snapshot['uncertified_count']} batch(es) awaiting quality certification",
                "description": f"At least {pieces:,} available sulur are not yet certified. Inspect size grading and issue the certificate.",
                "confidence": 88, "impact": "Certified stock ready for use or sale", "action": "Certify batches",
            })

        return recs

    @staticmethod
    def get_overview(db: Session, months: int = 6) -> Dict:
        """Sulur analytics: stock position, grade and treatment split, movement trend and period KPIs"""
        today = date.today()
        batches = db.query(SulurBatch).all()
        month_starts = _month_keys(months, today)
        movements = db.query(SulurMovement).filter(SulurMovement.movement_date >= month_starts[0]).all()

        trend = {m: {t: 0 for t in ("stock_in", "plant", "sell", "damage")} for m in month_starts}
        for mv in movements:
            bucket = trend.get(mv.movement_date.replace(day=1))
            kind = "sell" if mv.movement_type == "stock_out" else mv.movement_type
            if bucket is not None and kind in bucket:
                bucket[kind] += mv.quantity or 0

        def split(attr: str) -> List[Dict]:
            rows: Dict[str, Dict] = {}
            for b in batches:
                key = getattr(b, attr) or "unspecified"
                r = rows.setdefault(key, {"name": key, "batches": 0, "available": 0})
                r["batches"] += 1
                r["available"] += b.available_quantity or 0
            return sorted(rows.values(), key=lambda r: r["name"])

        def period(start: date, end: date) -> Dict:
            ms = [m for m in movements if start <= m.movement_date < end]
            t = _movement_totals(ms)
            return {
                "stock_in": t.get("stock_in", 0),
                "planted": t.get("plant", 0),
                "sold": t.get("sell", 0) + t.get("stock_out", 0),
                "damaged": t.get("damage", 0),
                "movements": len(ms),
            }

        # Previous period may start before the trend window; fetch it separately so it is complete
        prev_start, cur_start, end = today - timedelta(days=60), today - timedelta(days=30), today + timedelta(days=1)
        if prev_start < month_starts[0]:
            movements += db.query(SulurMovement).filter(
                SulurMovement.movement_date >= prev_start, SulurMovement.movement_date < month_starts[0]
            ).all()

        snapshot = SulurInsightsService.build_snapshot(db, today=today)
        return {
            "generated_at": today.isoformat(),
            "unit": UNIT,
            "has_data": len(batches) > 0,
            "batches": len(batches),
            "certified_batches": snapshot["certified_batches"],
            "totals": snapshot["totals"],
            "by_variety": snapshot["by_variety"],
            "by_grade": split("size_grade"),
            "by_treatment": split("treatment_status"),
            "movement_trend": [{"month": m.strftime("%b"), **v} for m, v in trend.items()],
            "kpis": {"current": period(cur_start, end), "previous": period(prev_start, cur_start), "period_days": 30},
            "alerts": {
                "below_threshold": sum(1 for v in snapshot["by_variety"] if v["below_threshold"]),
                "aging_batches": len(snapshot["aging_batches"]),
                "uncertified_batches": snapshot["uncertified_count"],
            },
        }
