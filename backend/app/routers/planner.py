"""
Harvest & Profit Planner API (FR12), admin only

Calculations are deterministic (services/planner_service.py) and nothing is
stored: planning scenarios never touch harvest, grading, transport or waste records.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import get_db
from app.middleware.rbac import require_admin
from app.schemas import (
    HistoricalYieldResponse, PlannerCompareRequest, PlannerCompareResponse, PlannerInput, PlannerResult,
    WhatIfResponse,
)
from app.services.planner_service import PlannerError, PlannerService

router = APIRouter()


@router.post("/calculate", response_model=PlannerResult)
def calculate_plan(
    data: PlannerInput,
    current_user: dict = Depends(require_admin),
):
    """
    Estimate harvest quantity, land, revenue, costs and profit

    - **mode**: `target_profit` (needs target_profit) or `forecast`
      (needs planned_harvest_kg or land_area_ha)
    - Variable cost is per marketable kg
    """
    try:
        return PlannerService.calculate(data.model_dump())
    except PlannerError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/compare", response_model=PlannerCompareResponse)
def compare_plans(
    data: PlannerCompareRequest,
    current_user: dict = Depends(require_admin),
):
    """Calculate several labelled scenarios (e.g. Conservative, Expected, Optimistic) side by side"""
    items = []
    for scenario in data.scenarios:
        try:
            items.append({"label": scenario.label, "result": PlannerService.calculate(scenario.inputs.model_dump())})
        except PlannerError as e:
            items.append({"label": scenario.label, "error": str(e)})
    return {"items": items}


@router.post("/what-if", response_model=WhatIfResponse)
def what_if_scenarios(
    data: PlannerInput,
    current_user: dict = Depends(require_admin),
):
    """
    Conservative, Expected and Optimistic versions of the given plan

    Expected uses the inputs exactly. The others apply fixed, documented
    adjustments to price, costs, yield and productivity (returned in `rules`);
    the target profit, planned harvest or land area stays the same.
    """
    return PlannerService.what_if(data.model_dump())


@router.get("/historical-yield", response_model=HistoricalYieldResponse)
def get_historical_yield(
    months: int = Query(12, ge=1, le=60),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Quantity-weighted marketable yield from recorded grading, offered as a planning default"""
    return PlannerService.historical_yield(db, months)
