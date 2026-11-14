"""
Harvest & Profit Planner (FR12)

Deterministic planning estimates. This is the only place the planner formulas
live; the API routes call it and the frontend displays what it returns.
Nothing here reads or writes farm records except historical_yield(), which
only reads them. No AI is involved.

Model (all variable costs are per MARKETABLE kg):

  Marketable kg   = Harvest kg x Marketable yield rate
  Revenue         = Marketable kg x Selling price per kg
  Variable cost   = Marketable kg x Variable cost per marketable kg
  Total cost      = Fixed cost + Variable cost
  Profit          = Revenue - Total cost
  Profit margin % = Profit / Revenue x 100           (undefined when revenue is 0)
  Land (ha)       = Harvest kg / Productivity (kg/ha)

  Target-profit mode:
  Required marketable kg = (Target profit + Fixed cost) / (Selling price - Variable cost)
  Required harvest kg    = Required marketable kg / Marketable yield rate

Arithmetic uses Decimal throughout and rounds only the returned figures:
money to RM 0.01 and percentages to 0.01 (half up), quantities to 0.01 kg and
land to 0.001 ha. In target-profit mode the required quantities and land are
rounded UP, so harvesting the stated amount meets the target; the money
figures are calculated from the exact required quantity.
"""

from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Harvest
from app.services.yield_calc import farm_yield

CALCULATION_VERSION = "fr12-v1"

DISCLAIMER = (
    "Planning estimate only, based on the assumptions entered. Actual yield, prices and costs vary, "
    "so this is not a guaranteed financial result."
)

# Fewest grade-based batches needed before a historical yield is offered as a default
MIN_HISTORY_BATCHES = 3

HISTORY_RULES = (
    "Quantity-weighted: total marketable kg / total harvested kg over batches harvested in the period that "
    "have recorded grade quantities (FR08). Marketable kg is the FR09 figure after spoilage and rejection. "
    "Legacy single-grade batches and ungraded batches are excluded because their marketable quantity is not "
    "comparable."
)

RM = Decimal("0.01")
KG = Decimal("0.01")
HA = Decimal("0.001")
PCT = Decimal("0.01")
HUNDRED = Decimal("100")
ZERO = Decimal("0")


def _q(value: Decimal, step: Decimal, up: bool = False) -> float:
    return float(value.quantize(step, rounding=ROUND_CEILING if up else ROUND_HALF_UP))


def _d(value) -> Decimal:
    return Decimal(str(value))


def _fmt(value: Decimal, step: Decimal) -> str:
    return f"{value.quantize(step, rounding=ROUND_HALF_UP):,}"


# What-if scenarios: fixed, hypothetical adjustments to the planner's own inputs.
# They show sensitivity to the assumptions; they are not forecasts or predictions.
# Prices, costs and productivity change by a percentage of the entered value;
# marketable yield changes by percentage points (kept within 1-100%).
# The target profit, planned harvest or land area is never changed.
WHAT_IF_ADJUSTMENTS = {
    "Conservative": {
        "selling_price_per_kg": Decimal("-10"),
        "variable_cost_per_kg": Decimal("10"),
        "fixed_cost": Decimal("10"),
        "marketable_yield_percent": Decimal("-5"),
        "productivity_kg_per_ha": Decimal("-10"),
    },
    "Expected": {},
    "Optimistic": {
        "selling_price_per_kg": Decimal("10"),
        "variable_cost_per_kg": Decimal("-10"),
        "fixed_cost": Decimal("-10"),
        "marketable_yield_percent": Decimal("5"),
        "productivity_kg_per_ha": Decimal("10"),
    },
}

WHAT_IF_FIELDS = {
    "selling_price_per_kg": ("Selling price", "RM/kg", "percent"),
    "variable_cost_per_kg": ("Variable cost per marketable kg", "RM/kg", "percent"),
    "fixed_cost": ("Fixed cost", "RM", "percent"),
    "marketable_yield_percent": ("Marketable yield", "%", "points"),
    "productivity_kg_per_ha": ("Productivity", "kg/ha", "percent"),
}

WHAT_IF_NOTE = (
    "Hypothetical adjustments to your inputs, for comparison only. They are fixed rules, not predictions by "
    "PineTrack Agent or anyone else, and none of the results is guaranteed."
)


class PlannerError(ValueError):
    """The inputs describe a plan the model cannot produce"""


class PlannerService:
    """FR12 planning calculations"""

    @staticmethod
    def calculate(inputs: Dict) -> Dict:
        """
        inputs: validated PlannerInput as a dict, with
          mode: "target_profit" or "forecast"
          selling_price_per_kg, variable_cost_per_kg, fixed_cost, marketable_yield_percent,
          productivity_kg_per_ha, plus target_profit (target mode) or
          planned_harvest_kg / land_area_ha (forecast mode)

        Raises:
            PlannerError: the target cannot be reached under the model
        """
        mode = inputs["mode"]
        price = _d(inputs["selling_price_per_kg"])
        variable = _d(inputs["variable_cost_per_kg"])
        fixed = _d(inputs["fixed_cost"])
        yield_pct = _d(inputs["marketable_yield_percent"])
        productivity = _d(inputs["productivity_kg_per_ha"])
        rate = yield_pct / HUNDRED
        margin_per_kg = price - variable

        notes: List[str] = []
        if mode == "target_profit":
            target = _d(inputs["target_profit"])
            if margin_per_kg <= 0:
                raise PlannerError(
                    f"The selling price (RM {_fmt(price, RM)}/kg) must be higher than the variable cost per "
                    f"marketable kg (RM {_fmt(variable, RM)}/kg). Otherwise every extra kilogram loses money "
                    "and no harvest quantity reaches the target profit."
                )
            if rate <= 0:
                raise PlannerError("Marketable yield must be greater than 0% to reach a target profit")
            marketable = (target + fixed) / margin_per_kg
            harvest = marketable / rate
            harvest_source = "required"
        else:
            if inputs.get("planned_harvest_kg") is not None:
                harvest = _d(inputs["planned_harvest_kg"])
                harvest_source = "planned_harvest"
            else:
                harvest = _d(inputs["land_area_ha"]) * productivity
                harvest_source = "land_area"
            marketable = harvest * rate
            if margin_per_kg <= 0:
                notes.append(
                    "The variable cost per kg is at or above the selling price, so a larger harvest only adds to the loss."
                )

        land = harvest / productivity
        revenue = marketable * price
        variable_total = marketable * variable
        total_cost = fixed + variable_total
        profit = revenue - total_cost
        margin = profit / revenue * HUNDRED if revenue > 0 else None
        break_even = fixed / margin_per_kg if margin_per_kg > 0 else None

        if profit < 0:
            notes.append("This plan is expected to make a loss.")
        if margin is None:
            notes.append("Profit margin is not defined because the expected revenue is RM 0.")

        up = mode == "target_profit"
        result = {
            "mode": mode,
            "calculation_version": CALCULATION_VERSION,
            "harvest_kg": _q(harvest, KG, up),
            "marketable_kg": _q(marketable, KG, up),
            "land_ha": _q(land, HA, up),
            "revenue": _q(revenue, RM),
            "variable_cost": _q(variable_total, RM),
            "fixed_cost": _q(fixed, RM),
            "total_cost": _q(total_cost, RM),
            "profit": _q(profit, RM),
            "profit_margin_percent": _q(margin, PCT) if margin is not None else None,
            "contribution_per_kg": _q(margin_per_kg, RM),
            "break_even_marketable_kg": _q(break_even, KG, True) if break_even is not None else None,
            "harvest_source": harvest_source,
            "assumptions": {
                "selling_price_per_kg": float(price),
                "variable_cost_per_kg": float(variable),
                "fixed_cost": float(fixed),
                "marketable_yield_percent": float(yield_pct),
                "productivity_kg_per_ha": float(productivity),
                "target_profit": float(_d(inputs["target_profit"])) if mode == "target_profit" else None,
                "planned_harvest_kg": float(_d(inputs["planned_harvest_kg"])) if harvest_source == "planned_harvest" else None,
                "land_area_ha": float(_d(inputs["land_area_ha"])) if harvest_source == "land_area" else None,
                "variable_cost_basis": "per marketable kg",
            },
            "notes": notes,
            "disclaimer": DISCLAIMER,
        }
        result["steps"] = PlannerService._steps(mode, harvest_source, inputs, {
            "price": price, "variable": variable, "fixed": fixed, "yield_pct": yield_pct, "productivity": productivity,
            "harvest": harvest, "marketable": marketable, "land": land, "revenue": revenue,
            "variable_total": variable_total, "total_cost": total_cost, "profit": profit, "margin": margin,
        })
        return result

    @staticmethod
    def _steps(mode: str, source: str, inputs: Dict, v: Dict) -> List[Dict[str, str]]:
        """Each formula with the figures actually used, for "How was this calculated?" """
        rm = lambda x: f"RM {_fmt(x, RM)}"  # noqa: E731
        kgs = lambda x: f"{_fmt(x, KG)} kg"  # noqa: E731
        steps = []
        if mode == "target_profit":
            target = _d(inputs["target_profit"])
            steps += [
                {"label": "Required marketable quantity",
                 "formula": "(Target profit + Fixed cost) / (Selling price - Variable cost per kg)",
                 "working": f"({rm(target)} + {rm(v['fixed'])}) / ({rm(v['price'])} - {rm(v['variable'])}) = {kgs(v['marketable'])}"},
                {"label": "Required harvest quantity",
                 "formula": "Required marketable kg / Marketable yield rate",
                 "working": f"{kgs(v['marketable'])} / {_fmt(v['yield_pct'], PCT)}% = {kgs(v['harvest'])}"},
            ]
        else:
            if source == "land_area":
                steps.append({"label": "Harvest quantity", "formula": "Land area x Productivity",
                              "working": f"{_fmt(_d(inputs['land_area_ha']), HA)} ha x {_fmt(v['productivity'], KG)} kg/ha = {kgs(v['harvest'])}"})
            steps.append({"label": "Marketable quantity", "formula": "Harvest kg x Marketable yield rate",
                          "working": f"{kgs(v['harvest'])} x {_fmt(v['yield_pct'], PCT)}% = {kgs(v['marketable'])}"})
        if not (mode == "forecast" and source == "land_area"):
            steps.append({"label": "Land required", "formula": "Harvest kg / Productivity (kg/ha)",
                          "working": f"{kgs(v['harvest'])} / {_fmt(v['productivity'], KG)} kg/ha = {_fmt(v['land'], HA)} ha"})
        steps += [
            {"label": "Revenue", "formula": "Marketable kg x Selling price per kg",
             "working": f"{kgs(v['marketable'])} x {rm(v['price'])} = {rm(v['revenue'])}"},
            {"label": "Variable cost", "formula": "Marketable kg x Variable cost per marketable kg",
             "working": f"{kgs(v['marketable'])} x {rm(v['variable'])} = {rm(v['variable_total'])}"},
            {"label": "Total cost", "formula": "Fixed cost + Variable cost",
             "working": f"{rm(v['fixed'])} + {rm(v['variable_total'])} = {rm(v['total_cost'])}"},
            {"label": "Expected profit", "formula": "Revenue - Total cost",
             "working": f"{rm(v['revenue'])} - {rm(v['total_cost'])} = {rm(v['profit'])}"},
        ]
        if v["margin"] is not None:
            steps.append({"label": "Profit margin", "formula": "Profit / Revenue x 100",
                          "working": f"{rm(v['profit'])} / {rm(v['revenue'])} x 100 = {_fmt(v['margin'], PCT)}%"})
        return steps

    @staticmethod
    def what_if(inputs: Dict) -> Dict:
        """
        Conservative / Expected / Optimistic versions of one plan. Expected is the
        inputs unchanged; the others apply WHAT_IF_ADJUSTMENTS. Each is calculated
        with calculate(), so the formulas are the same as the main result.
        """
        rules = [
            {
                "field": key,
                "label": label,
                "unit": unit,
                "conservative": PlannerService._describe(WHAT_IF_ADJUSTMENTS["Conservative"][key], kind),
                "optimistic": PlannerService._describe(WHAT_IF_ADJUSTMENTS["Optimistic"][key], kind),
            }
            for key, (label, unit, kind) in WHAT_IF_FIELDS.items()
        ]
        scenarios = []
        for name, changes in WHAT_IF_ADJUSTMENTS.items():
            adjusted = dict(inputs)
            for key, change in changes.items():
                adjusted[key] = PlannerService._adjust(key, _d(inputs[key]), change)
            used = {key: float(_d(adjusted[key])) for key in WHAT_IF_FIELDS}
            try:
                scenarios.append({"label": name, "inputs": used, "result": PlannerService.calculate(adjusted), "error": None})
            except PlannerError as e:
                scenarios.append({"label": name, "inputs": used, "result": None, "error": str(e)})
        return {"scenarios": scenarios, "rules": rules, "note": WHAT_IF_NOTE}

    @staticmethod
    def _adjust(key: str, value: Decimal, change: Decimal) -> Decimal:
        if WHAT_IF_FIELDS[key][2] == "points":
            return min(max(value + change, Decimal("1")), HUNDRED)
        step = Decimal("0.0001") if key == "selling_price_per_kg" or key == "variable_cost_per_kg" else RM
        return (value * (HUNDRED + change) / HUNDRED).quantize(step, rounding=ROUND_HALF_UP)

    @staticmethod
    def _describe(change: Decimal, kind: str) -> str:
        sign = "+" if change > 0 else "−"
        return f"{sign}{abs(change):g} percentage points" if kind == "points" else f"{sign}{abs(change):g}%"

    @staticmethod
    def historical_yield(db: Session, months: int = 12, today: Optional[date] = None) -> Dict:
        """Quantity-weighted marketable yield from recorded grading (FR08/FR09). Read only."""
        end = today or date.today()
        start = end - timedelta(days=round(months * 30.44))
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= start, Harvest.harvest_date <= end).all()
        summary = farm_yield([h.yield_breakdown for h in harvests])
        batches = summary["graded_batches"]
        sufficient = batches >= MIN_HISTORY_BATCHES and summary["harvested_kg"] > 0
        if sufficient:
            message = None
        elif batches == 0:
            message = "No batches with recorded grade quantities in this period. Enter the marketable yield manually."
        else:
            message = (f"Only {batches} graded batch(es) in this period; at least {MIN_HISTORY_BATCHES} are needed "
                       "for a reliable average. Enter the marketable yield manually.")
        return {
            "available": sufficient,
            "marketable_yield_percent": summary["marketable_yield_percent"] if sufficient else None,
            "period_start": start,
            "period_end": end,
            "months": months,
            "included_batches": batches,
            "harvested_kg": summary["harvested_kg"],
            "marketable_kg": summary["marketable_kg"],
            "excluded_legacy_batches": summary["legacy_batches"],
            "excluded_ungraded_batches": summary["ungraded_batches"],
            "min_batches": MIN_HISTORY_BATCHES,
            "rules": HISTORY_RULES,
            "message": message,
        }
