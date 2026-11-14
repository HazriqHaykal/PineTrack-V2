"""
The single calculation of a batch's marketable quantity (FR09)

Everything that needs a batch's marketable quantity (the Harvest model, batch
reconciliation, transport allocation, statistics, analytics and reports) gets
it from compute_yield(). Nothing else subtracts losses on its own.

Quantity-accounting policy, all weights in kg rounded to 0.01 with Decimal:

  Grade-based batch: every harvested kg is in exactly one bucket at sorting
    Harvested           = A + B + C + D + Non-marketable at sorting
    Non-marketable at sorting = Harvested - sum of grades. The farmer weighs it
                        at harvest; it is stored as part of rejected_kg and
                        logged once in Waste Management.
    Graded marketable   = sum of the grades counted as marketable when graded
                        (by default every grade, D included)
    Excluded grades     = sum of any grades the farm policy excludes (none by default)
    Rejected after grading = rejected_kg - Non-marketable at sorting
    Spoilage            = graded fruit found spoiled later
    Marketable          = Graded marketable - Spoilage - Rejected after grading

  rejected_kg is therefore the batch's total rejection (at sorting + after
  grading), and each kilogram is subtracted in exactly one place. Batches graded
  before non-marketable sorting existed have grades adding up to the harvest, so
  all of their rejection counts as "after grading", as it did before.

  Legacy batch (one overall grade, recorded before grading breakdowns existed)
  and ungraded batch (no grading yet)
    Marketable        = Harvested - Spoilage - Rejected   (unchanged formula)

  Marketable yield %  = Marketable / Harvested x 100
  Grading yield %     = Graded marketable / Harvested x 100 (grade-based only)

Whether a grade counts as marketable is stored on each grade row when the
breakdown is saved, so a later policy change never alters an existing batch.

This module imports no models, so the models can use it without a cycle.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Iterable, List, Optional, Tuple

KG = Decimal("0.01")
ZERO = Decimal("0")
HUNDRED = Decimal("100")

GRADES: Tuple[str, ...] = ("A", "B", "C", "D")
DEFAULT_MARKETABLE_GRADES: Tuple[str, ...] = ("A", "B", "C", "D")

BASIS_GRADE = "grade_based"
BASIS_LEGACY = "legacy"
BASIS_UNGRADED = "ungraded"


def kg(value) -> Decimal:
    """Convert a stored float to an exact kilogram amount (0.01 kg precision)"""
    return Decimal(str(value or 0)).quantize(KG, rounding=ROUND_HALF_UP)


def percent(part: Decimal, whole: Decimal) -> Decimal:
    if whole <= 0:
        return ZERO
    return (part / whole * HUNDRED).quantize(KG, rounding=ROUND_HALF_UP)


def summary_grade(quantities: Dict[str, Decimal]) -> str:
    """Overall grade label kept on the batch: the letter when one grade holds it all, otherwise "mixed" """
    present = [g for g in GRADES if quantities.get(g, ZERO) > 0]
    if not present:
        return "ungraded"  # the whole batch was sorted out as non-marketable
    return present[0] if len(present) == 1 else "mixed"


def grading_basis(has_breakdown: bool, quality_grade: Optional[str]) -> str:
    if has_breakdown:
        return BASIS_GRADE
    if (quality_grade or "").strip().upper() in GRADES:
        return BASIS_LEGACY
    return BASIS_UNGRADED


def compute_yield(
    harvested,
    spoilage,
    rejected,
    grade_rows: Optional[Iterable[Tuple[str, object, bool]]] = None,
    quality_grade: Optional[str] = None,
) -> Dict:
    """
    Marketable quantity for one batch.

    grade_rows: (grade, quantity_kg, is_marketable) for each recorded grade, or
    None/empty when the batch has no grading breakdown.
    """
    rows: List[Tuple[str, Decimal, bool]] = [(g, kg(q), bool(m)) for g, q, m in (grade_rows or [])]
    harvested_kg = kg(harvested)
    spoilage_kg = kg(spoilage)
    rejected_kg = kg(rejected)
    basis = grading_basis(bool(rows), quality_grade)

    if rows:
        quantities = {g: q for g, q, _ in rows}
        graded_total = sum((q for _, q, _ in rows), ZERO)
        graded_marketable = sum((q for _, q, m in rows if m), ZERO)
        non_marketable = graded_total - graded_marketable
        sorted_out = max(harvested_kg - graded_total, ZERO)
        # The sorting-stage non-marketable kg is always part of the rejection
        rejected_kg = max(rejected_kg, sorted_out)
        rejected_after = rejected_kg - sorted_out
        marketable = max(graded_marketable - spoilage_kg - rejected_after, ZERO)
        marketable_grades = [g for g, _, m in rows if m]
    else:
        quantities = None
        graded_total = graded_marketable = non_marketable = sorted_out = rejected_after = None
        marketable = max(harvested_kg - spoilage_kg - rejected_kg, ZERO)
        marketable_grades = None

    return {
        "basis": basis,
        "harvested": harvested_kg,
        "spoilage": spoilage_kg,
        "rejected": rejected_kg,
        # Everything not marketable: spoilage, rejection and any excluded grades
        "losses": spoilage_kg + rejected_kg + (non_marketable or ZERO),
        "marketable": marketable,
        "marketable_percent": percent(marketable, harvested_kg),
        "grades": quantities,
        "graded_total": graded_total,
        "graded_marketable": graded_marketable,
        "non_marketable": non_marketable,
        "rejected_at_sorting": sorted_out,
        "rejected_after_grading": rejected_after,
        "grading_percent": percent(graded_marketable, harvested_kg) if rows else None,
        "marketable_grades": marketable_grades,
    }


def farm_yield(results: Iterable[Dict]) -> Dict:
    """
    Quantity-weighted marketable yield across batches:
      Farm yield % = sum(marketable kg) / sum(harvested kg) x 100
    Only grade-based batches are comparable, so legacy and ungraded batches are
    counted separately and left out of the yield.

    results: compute_yield() outputs
    """
    graded = {"batches": 0, "harvested": ZERO, "marketable": ZERO, "graded_marketable": ZERO,
              "non_marketable": ZERO, "spoilage": ZERO, "rejected": ZERO}
    by_grade = {g: ZERO for g in GRADES}
    excluded = {BASIS_LEGACY: [0, ZERO], BASIS_UNGRADED: [0, ZERO]}

    for r in results:
        if r["basis"] != BASIS_GRADE:
            excluded[r["basis"]][0] += 1
            excluded[r["basis"]][1] += r["harvested"]
            continue
        graded["batches"] += 1
        graded["harvested"] += r["harvested"]
        graded["marketable"] += r["marketable"]
        graded["graded_marketable"] += r["graded_marketable"]
        graded["non_marketable"] += r["non_marketable"]
        graded["spoilage"] += r["spoilage"]
        graded["rejected"] += r["rejected"]
        for g, q in r["grades"].items():
            by_grade[g] += q

    total = graded["harvested"]
    return {
        "graded_batches": graded["batches"],
        "harvested_kg": float(total),
        "marketable_kg": float(graded["marketable"]),
        "graded_marketable_kg": float(graded["graded_marketable"]),
        "non_marketable_kg": float(graded["non_marketable"]),
        "spoilage_kg": float(graded["spoilage"]),
        "rejected_kg": float(graded["rejected"]),
        "marketable_yield_percent": float(percent(graded["marketable"], total)) if total else None,
        "grading_yield_percent": float(percent(graded["graded_marketable"], total)) if total else None,
        "grade_kg": {g: float(q) for g, q in by_grade.items()},
        "grade_percent": {g: float(percent(q, total)) for g, q in by_grade.items()},
        "legacy_batches": excluded[BASIS_LEGACY][0],
        "legacy_kg": float(excluded[BASIS_LEGACY][1]),
        "ungraded_batches": excluded[BASIS_UNGRADED][0],
        "ungraded_kg": float(excluded[BASIS_UNGRADED][1]),
    }
