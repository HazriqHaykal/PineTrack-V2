"""
Pineapple grading (FR08) and the marketability policy

The farmer enters the kilograms of each grade by hand; nothing here grades
fruit automatically. The marketable quantity itself is calculated only in
yield_calc.compute_yield().
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

# Waste types a farmer can give for fruit sorted out as non-marketable
SORTED_OUT_WASTE_TYPES = ("damaged", "rotten", "overripe", "other")

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Harvest, HarvestGrade, MarketabilityPolicy, Waste
from app.services.yield_calc import DEFAULT_MARKETABLE_GRADES, GRADES, ZERO, kg, summary_grade

POLICY_EXPLANATION = (
    "Marketable grades can be sold and allocated to transport; spoilage and rejection recorded on the batch "
    "are deducted from them. A grade left out of the policy is excluded from marketable stock entirely. "
    "Each batch keeps the policy that applied when its grades were saved; a policy change only affects "
    "batches graded or re-graded afterwards."
)

DEFAULT_POLICY_NOTE = (
    "Default: every grade (A, B, C and D) is marketable. Unsellable fruit is recorded as spoilage or rejection."
)


def _fmt(value: Decimal) -> str:
    text = format(value, "f")
    return (text.rstrip("0").rstrip(".") if "." in text else text) + " kg"


class GradingService:
    """Grading breakdowns and marketability policy versions"""

    # ── Policy ───────────────────────────────────────────────────────────

    @staticmethod
    def current_policy(db: Session) -> MarketabilityPolicy:
        """The newest policy version, creating the illustrative default the first time"""
        policy = db.query(MarketabilityPolicy).order_by(desc(MarketabilityPolicy.id)).first()
        if policy is None:
            policy = MarketabilityPolicy(
                marketable_grades=",".join(DEFAULT_MARKETABLE_GRADES), note=DEFAULT_POLICY_NOTE,
            )
            db.add(policy)
            db.flush()
        return policy

    @staticmethod
    def list_policies(db: Session) -> List[MarketabilityPolicy]:
        GradingService.current_policy(db)
        return db.query(MarketabilityPolicy).order_by(desc(MarketabilityPolicy.id)).all()

    @staticmethod
    def update_policy(
        db: Session, marketable_grades: List[str], actor_id: Optional[int], note: Optional[str] = None
    ) -> MarketabilityPolicy:
        """
        Add a new policy version. Existing batches are not recalculated.

        Raises:
            ValueError: invalid grade list
        """
        grades = sorted({(g or "").strip().upper() for g in marketable_grades})
        unknown = [g for g in grades if g not in GRADES]
        if unknown:
            raise ValueError(f"Unknown grade(s): {', '.join(unknown)}. Use A, B, C or D")
        if not grades:
            raise ValueError("At least one grade must be marketable")

        current = GradingService.current_policy(db)
        if current.grades == grades:
            return current  # nothing changed, so no new version

        policy = MarketabilityPolicy(
            marketable_grades=",".join(grades), note=(note or "").strip() or None, created_by=actor_id,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
        return policy

    @staticmethod
    def serialize_policy(policy: MarketabilityPolicy, current_id: Optional[int] = None) -> Dict:
        author = policy.author
        return {
            "version": policy.id,
            "marketable_grades": policy.grades,
            "non_marketable_grades": [g for g in GRADES if g not in policy.grades],
            "note": policy.note,
            "created_at": policy.created_at,
            "created_by": (author.full_name or author.username) if author else None,
            "is_current": current_id is None or policy.id == current_id,
            "explanation": POLICY_EXPLANATION,
        }

    # ── Breakdown ────────────────────────────────────────────────────────

    @staticmethod
    def validate_breakdown(harvested_kg, grades: Dict[str, Optional[float]], non_marketable_kg=None) -> Dict[str, Decimal]:
        """
        Check a grading breakdown against the harvested total:
        A + B + C + D + non-marketable at sorting = harvested.

        Grades left out (or null) count as 0 kg once any grade is entered: the
        farmer has graded the batch and found none of that grade.

        Returns:
            {grade: kg} for all four grades
        Raises:
            ValueError: with a message suitable for the user
        """
        if not isinstance(grades, dict) or (not grades and not non_marketable_kg):
            raise ValueError("Enter the quantity of at least one grade")
        rejected = kg(non_marketable_kg or 0)
        if rejected < 0:
            raise ValueError("Non-marketable quantity cannot be negative")

        quantities: Dict[str, Decimal] = {g: ZERO for g in GRADES}
        for key, value in grades.items():
            grade = str(key).strip().upper().replace("GRADE", "").strip()
            if grade not in GRADES:
                raise ValueError(f"Unknown grade '{key}'. Use A, B, C or D")
            if value is None:
                continue
            amount = kg(value)
            if amount < 0:
                raise ValueError(f"Grade {grade} quantity cannot be negative")
            quantities[grade] = amount

        harvested = kg(harvested_kg)
        if harvested <= 0:
            raise ValueError("Total harvested quantity must be greater than 0")
        for grade, amount in quantities.items():
            if amount > harvested:
                raise ValueError(
                    f"Grade {grade} quantity ({_fmt(amount)}) cannot exceed the harvested quantity ({_fmt(harvested)})"
                )

        if rejected > harvested:
            raise ValueError(
                f"Non-marketable quantity ({_fmt(rejected)}) cannot exceed the harvested quantity ({_fmt(harvested)})"
            )
        total = sum(quantities.values(), ZERO) + rejected
        if total == 0:
            raise ValueError("Enter the quantity of at least one grade")
        if total != harvested:
            diff = harvested - total
            hint = f"{_fmt(diff)} still to grade" if diff > 0 else f"{_fmt(-diff)} too much"
            what = "Grade and non-marketable quantities" if rejected else "Grade quantities"
            raise ValueError(
                f"{what} add up to {_fmt(total)} but the harvested quantity is {_fmt(harvested)} ({hint})"
            )
        return quantities

    @staticmethod
    def proposed_rows(
        quantities: Dict[str, Decimal], policy: MarketabilityPolicy
    ) -> List[Tuple[str, Decimal, bool]]:
        marketable = set(policy.grades)
        return [(g, quantities[g], g in marketable) for g in GRADES]

    @staticmethod
    def apply_breakdown(
        harvest: Harvest, quantities: Dict[str, Decimal], policy: MarketabilityPolicy
    ) -> None:
        """
        Store the breakdown on the batch (caller commits). Rows are updated in
        place, so each grade keeps one row per batch.

        The overall grade label is derived from it. Spoilage and rejection are
        kept as recorded; they come out of the marketable grades.
        """
        existing = {row.grade: row for row in harvest.grades}
        marketable = set(policy.grades)
        now = datetime.utcnow()
        for grade in GRADES:
            row = existing.get(grade)
            if row is None:
                harvest.grades.append(HarvestGrade(
                    grade=grade, quantity_kg=float(quantities[grade]),
                    is_marketable=grade in marketable, policy_id=policy.id,
                ))
            else:
                row.quantity_kg = float(quantities[grade])
                row.is_marketable = grade in marketable
                row.policy_id = policy.id
                row.updated_at = now

        harvest.quality_grade = summary_grade(quantities)
        if harvest.harvest_status == "pending":
            harvest.harvest_status = "graded"

    @staticmethod
    def sorted_out_waste(harvest: Harvest, amount: Decimal, waste_type: str, user_id: int) -> "Waste":
        """
        Waste record for the non-marketable kg sorted out at harvest, linked to
        the batch. It classifies the rejection already on the batch and is not
        subtracted again (see batch_service).
        """
        return Waste(
            user_id=user_id,
            harvest_id=harvest.id,
            waste_type=waste_type,
            quantity_kg=float(amount),
            waste_date=harvest.harvest_date,
            classification="compostable",
            notes=f"Non-marketable fruit sorted out at harvest of batch {harvest.batch_number}.",
        )

    @staticmethod
    def grading_summary(harvest: Harvest, policy: Optional[MarketabilityPolicy] = None) -> Dict:
        """Grading & yield panel for one batch"""
        y = harvest.yield_breakdown
        rows = []
        if y["grades"] is not None:
            flags = {g.grade: g.is_marketable for g in harvest.grades}
            for grade in GRADES:
                amount = y["grades"].get(grade, ZERO)
                rows.append({
                    "grade": grade,
                    "quantity_kg": float(amount),
                    "percent": float((amount / y["harvested"] * 100).quantize(Decimal("0.01"))) if y["harvested"] else 0.0,
                    "is_marketable": bool(flags.get(grade, False)),
                })
        return {
            "basis": y["basis"],
            "grades": rows,
            "harvested_kg": float(y["harvested"]),
            "graded_marketable_kg": float(y["graded_marketable"]) if y["graded_marketable"] is not None else None,
            "rejected_at_sorting_kg": float(y["rejected_at_sorting"]) if y["rejected_at_sorting"] is not None else None,
            "rejected_after_grading_kg": float(y["rejected_after_grading"]) if y["rejected_after_grading"] is not None else None,
            "non_marketable_kg": float(y["non_marketable"]) if y["non_marketable"] is not None else None,
            "spoilage_kg": float(y["spoilage"]),
            "rejected_kg": float(y["rejected"]),
            "marketable_kg": float(y["marketable"]),
            "marketable_yield_percent": float(y["marketable_percent"]),
            "grading_yield_percent": float(y["grading_percent"]) if y["grading_percent"] is not None else None,
            "marketable_grades": y["marketable_grades"],
            "policy_version": harvest.grading_policy_version,
            "current_policy_version": policy.id if policy else None,
            "legacy_grade": harvest.quality_grade if y["basis"] == "legacy" else None,
            "policy_explanation": POLICY_EXPLANATION,
        }
