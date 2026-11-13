"""
PineTrack V2.0 - Sulur (Pineapple Seed) Inventory, Traceability, Planning & Certification Router
Module by: Muhammad Arif Omar Bin Akashah (222580)
In Collaboration with Seri Nanas Farm Sdn. Bhd. & Zanko Sdn. Bhd.
"""

import io
import json
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import get_db
from app import models, schemas

# Graceful RBAC import that matches Hazriq's middleware/rbac.py or dependencies
try:
    from app.middleware.rbac import get_current_user
except ImportError:
    try:
        from app.routers.auth import get_current_user
    except ImportError:
        def get_current_user(db: Session = Depends(get_db)):
            user = db.query(models.User).first()
            if not user:
                raise HTTPException(status_code=401, detail="No user found")
            return user

router = APIRouter()

DEFAULT_VARIETY_CONFIGS = [
    {
        "variety": "MD2",
        "default_planting_density_ha": 43500,
        "npk_fertilizer_kg_per_1000": 45.0,
        "foliar_fertilizer_l_per_1000": 4.0,
        "sulur_unit_cost_rm": 0.90,
        "sulur_selling_price_rm": 1.60,
        "fruit_selling_price_rm_kg": 4.20,
        "avg_fruit_weight_kg": 1.7,
        "nutrient_cost_per_1000_rm": 380.0,
        "operational_cost_per_ha_rm": 5000.0,
        "min_stock_threshold": 5000,
    },
    {
        "variety": "Moris",
        "default_planting_density_ha": 40000,
        "npk_fertilizer_kg_per_1000": 38.0,
        "foliar_fertilizer_l_per_1000": 3.0,
        "sulur_unit_cost_rm": 0.55,
        "sulur_selling_price_rm": 1.10,
        "fruit_selling_price_rm_kg": 2.60,
        "avg_fruit_weight_kg": 1.4,
        "nutrient_cost_per_1000_rm": 320.0,
        "operational_cost_per_ha_rm": 4200.0,
        "min_stock_threshold": 5000,
    },
    {
        "variety": "Josapine",
        "default_planting_density_ha": 43500,
        "npk_fertilizer_kg_per_1000": 42.0,
        "foliar_fertilizer_l_per_1000": 3.5,
        "sulur_unit_cost_rm": 0.70,
        "sulur_selling_price_rm": 1.35,
        "fruit_selling_price_rm_kg": 3.20,
        "avg_fruit_weight_kg": 1.5,
        "nutrient_cost_per_1000_rm": 350.0,
        "operational_cost_per_ha_rm": 4600.0,
        "min_stock_threshold": 5000,
    },
    {
        "variety": "N36",
        "default_planting_density_ha": 38000,
        "npk_fertilizer_kg_per_1000": 40.0,
        "foliar_fertilizer_l_per_1000": 3.2,
        "sulur_unit_cost_rm": 0.65,
        "sulur_selling_price_rm": 1.25,
        "fruit_selling_price_rm_kg": 2.90,
        "avg_fruit_weight_kg": 1.8,
        "nutrient_cost_per_1000_rm": 340.0,
        "operational_cost_per_ha_rm": 4400.0,
        "min_stock_threshold": 4000,
    },
]


def ensure_default_configs(db: Session) -> List[models.SulurReferenceConfig]:
    """Seeds LPNM/MPIB default variety reference values if table is empty."""
    existing = db.query(models.SulurReferenceConfig).all()
    if not existing:
        for cfg in DEFAULT_VARIETY_CONFIGS:
            db.add(models.SulurReferenceConfig(**cfg))
        db.commit()
        existing = db.query(models.SulurReferenceConfig).all()
    return existing



def ensure_sample_sulur_data(db: Session, current_user_id: int = 1):
    """Auto-seeds realistic Seri Nanas Farm Sulur batches, movements & plans if database is empty."""
    ensure_default_configs(db)
    if db.query(models.SulurBatch).count() > 0:
        return

    user = db.query(models.User).first()
    uid = user.id if user else current_user_id

    sample_batches = [
        models.SulurBatch(
            user_id=uid,
            batch_code="SLR-202610-MD2-001",
            variety="MD2",
            sulur_type="sucker",
            size_grade="Grade A",
            initial_quantity=15000,
            available_quantity=11500,
            reserved_quantity=2000,
            planted_quantity=1500,
            sold_quantity=0,
            damaged_quantity=0,
            source_plot="Block A1 - Seri Nanas Farm",
            storage_location="Nursery Shed 1 (Bays 1-4)",
            date_received=date(2026, 10, 28),
            treatment_status="ready_to_plant",
            stock_status="available",
            is_certified=True,
            certificate_number="CERT-LPNM-SNF-2026-0001",
            certified_by="Prof. Madya Dr. Rodziah / SNF Manager",
            certified_date=date(2026, 10, 29),
            quality_remarks="LPNM Grade A (35-42cm uniform suckers). Fungicide dipped & cured.",
        ),
        models.SulurBatch(
            user_id=uid,
            batch_code="SLR-202610-MOR-002",
            variety="Moris",
            sulur_type="sucker",
            size_grade="Grade A",
            initial_quantity=12000,
            available_quantity=8800,
            reserved_quantity=1000,
            planted_quantity=2000,
            sold_quantity=0,
            damaged_quantity=200,
            source_plot="Block C2 - Seri Nanas Farm",
            storage_location="Nursery Shed 2",
            date_received=date(2026, 10, 20),
            treatment_status="fungicide_treated",
            stock_status="available",
            is_certified=True,
            certificate_number="CERT-LPNM-SNF-2026-0002",
            certified_by="SNF Quality Inspector",
            certified_date=date(2026, 10, 22),
            quality_remarks="Healthy parent plant suckers, sorted for uniform Block C planting.",
        ),
        models.SulurBatch(
            user_id=uid,
            batch_code="SLR-202610-JOS-003",
            variety="Josapine",
            sulur_type="slip",
            size_grade="Grade B",
            initial_quantity=6000,
            available_quantity=3400,
            reserved_quantity=500,
            planted_quantity=1000,
            sold_quantity=1000,
            damaged_quantity=100,
            source_plot="Block B1 - Seri Nanas Farm",
            storage_location="Nursery Shed 1 (Bay 5)",
            date_received=date(2026, 10, 15),
            treatment_status="curing",
            stock_status="available",
            is_certified=False,
            certificate_number=None,
            certified_by=None,
            certified_date=None,
            quality_remarks="25-32cm slips currently in curing phase; pending final LPNM grading sign-off.",
        ),
        models.SulurBatch(
            user_id=uid,
            batch_code="SLR-202611-N36-004",
            variety="N36",
            sulur_type="sucker",
            size_grade="Grade A",
            initial_quantity=8000,
            available_quantity=6500,
            reserved_quantity=0,
            planted_quantity=1500,
            sold_quantity=0,
            damaged_quantity=0,
            source_plot="Zanko Partner Plot D",
            storage_location="Nursery Shed 3",
            date_received=date(2026, 11, 2),
            treatment_status="ready_to_plant",
            stock_status="available",
            is_certified=True,
            certificate_number="CERT-LPNM-SNF-2026-0004",
            certified_by="Muhammad Arif Omar",
            certified_date=date(2026, 11, 3),
            quality_remarks="Verified uniform Grade A N36 suckers ready for field cultivation.",
        ),
    ]
    db.add_all(sample_batches)
    db.flush()

    sample_movements = [
        models.SulurMovement(
            batch_id=sample_batches[0].id,
            user_id=uid,
            movement_type="stock_in",
            quantity=15000,
            destination_or_plot="Nursery Shed 1 (Bays 1-4)",
            movement_date=date(2026, 10, 28),
            remarks="Initial harvest of Grade A MD2 suckers from Block A1",
        ),
        models.SulurMovement(
            batch_id=sample_batches[0].id,
            user_id=uid,
            movement_type="plant",
            quantity=1500,
            destination_or_plot="Plot B2 - MD2 Expansion",
            movement_date=date(2026, 11, 1),
            remarks="Issued to field team for bed planting",
        ),
        models.SulurMovement(
            batch_id=sample_batches[0].id,
            user_id=uid,
            movement_type="reserve",
            quantity=2000,
            destination_or_plot="Plot B3 - Scheduled Next Week",
            movement_date=date(2026, 11, 5),
            remarks="Reserved for upcoming 0.5 ha MD2 cultivation plan",
        ),
        models.SulurMovement(
            batch_id=sample_batches[1].id,
            user_id=uid,
            movement_type="plant",
            quantity=2000,
            destination_or_plot="Plot C4 - Moris Zone",
            movement_date=date(2026, 11, 3),
            remarks="Planted uniform Grade A Moris batch",
        ),
        models.SulurMovement(
            batch_id=sample_batches[2].id,
            user_id=uid,
            movement_type="sell",
            quantity=1000,
            destination_or_plot="Smallholder Cooperative Johor",
            movement_date=date(2026, 11, 6),
            remarks="Sold excess Grade B Josapine slips at LPNM reference rate",
        ),
    ]
    db.add_all(sample_movements)

    sample_plan = models.SulurPlanRecord(
        user_id=uid,
        plan_title="Appendix 11.0 Benchmark  0.5 ha MD2 Cultivation Plan",
        variety="MD2",
        plan_mode="cultivation",
        land_area_ha=0.5,
        planting_density_ha=43500,
        mortality_buffer_percent=0.0,
        required_sulur=21750,
        available_sulur_at_plan=11500,
        stock_shortfall=10250,
        estimated_npk_kg=978.75,
        estimated_foliar_liters=87.0,
        sulur_cost_rm=5000.0,
        nutrient_cost_rm=8000.0,
        operational_cost_rm=2500.0,
        total_cost_rm=15500.0,
        estimated_revenue_rm=30000.0,
        projected_profit_rm=14500.0,
        roi_percent=93.55,
        recommendations_json=json.dumps([
            {
                "rule_code": "INSUFFICIENT_SULUR_STOCK",
                "severity": "critical",
                "category": "stock",
                "message": "Insufficient sulur stock for the selected planting plan. Required: 21,750 (MD2), Available: 11,500 (Shortfall: 10,250 sulur).",
                "action_suggested": "Procure 10,250 certified MD2 sulur or harvest additional suckers from Block A1."
            },
            {
                "rule_code": "HEALTHY_PROFIT_PROJECTION",
                "severity": "optimal",
                "category": "profit",
                "message": "Financially viable plan with projected profit of RM 14,500.00 (ROI: 93.55%).",
                "action_suggested": "Proceed with cultivation schedule and export PDF report for Farm Manager sign-off."
            }
        ])
    )
    db.add(sample_plan)
    db.commit()


def recompute_batch_status(batch: models.SulurBatch, min_threshold: int = 1000):
    """Automatically updates batch stock_status based on available/reserved/damaged counts."""
    if batch.available_quantity <= 0 and batch.reserved_quantity <= 0:
        batch.stock_status = "depleted"
    elif batch.available_quantity <= 0 and batch.reserved_quantity > 0:
        batch.stock_status = "reserved"
    elif batch.available_quantity < min_threshold:
        batch.stock_status = "low_stock"
    else:
        batch.stock_status = "available"


# ==============================================================================
# 1. DASHBOARD SUMMARY & SMART ALERTS (Inventories + Curing + Certification)
# ==============================================================================
@router.get("/summary")
def get_sulur_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sample_sulur_data(db, current_user.id)
    configs = {c.variety: c for c in ensure_default_configs(db)}
    batches = db.query(models.SulurBatch).order_by(models.SulurBatch.created_at.desc()).all()

    total_available = sum(b.available_quantity for b in batches)
    total_reserved = sum(b.reserved_quantity for b in batches)
    total_planted = sum(b.planted_quantity for b in batches)
    total_sold = sum(b.sold_quantity for b in batches)
    total_damaged = sum(b.damaged_quantity for b in batches)
    certified_batches = sum(1 for b in batches if b.is_certified)

    # Breakdown by variety
    variety_breakdown = {}
    for b in batches:
        v = variety_breakdown.setdefault(
            b.variety,
            {"variety": b.variety, "available": 0, "reserved": 0, "planted": 0, "sold": 0, "damaged": 0, "batches": 0},
        )
        v["available"] += b.available_quantity
        v["reserved"] += b.reserved_quantity
        v["planted"] += b.planted_quantity
        v["sold"] += b.sold_quantity
        v["damaged"] += b.damaged_quantity
        v["batches"] += 1

    # Smart Rule-Based Alerts
    alerts = []
    today = date.today()
    for v_name, cfg in configs.items():
        avail = variety_breakdown.get(v_name, {}).get("available", 0)
        if avail < cfg.min_stock_threshold:
            alerts.append({
                "rule_code": f"LOW_STOCK_{v_name.upper()}",
                "severity": "warning" if avail > 0 else "critical",
                "category": "stock",
                "message": f"Low stock alert for {v_name}: {avail:,} sulur available (Minimum threshold: {cfg.min_stock_threshold:,}).",
                "action_suggested": f"Consider harvesting new {v_name} suckers or procuring certified batches.",
            })

    for b in batches:
        days_stored = (today - b.date_received).days if b.date_received else 0
        if b.available_quantity > 0 and days_stored > 14 and b.treatment_status in ("raw", "curing"):
            alerts.append({
                "rule_code": "STORAGE_DURATION_WARNING",
                "severity": "warning",
                "category": "quality",
                "message": f"Batch {b.batch_code} ({b.variety}) has been stored for {days_stored} days in '{b.treatment_status}' state.",
                "action_suggested": "Complete fungicide treatment & grading immediately or schedule planting to prevent sulur dehydration.",
            })
        if b.available_quantity > 0 and not b.is_certified:
            alerts.append({
                "rule_code": "UNCERTIFIED_BATCH",
                "severity": "info",
                "category": "certification",
                "message": f"Batch {b.batch_code} ({b.available_quantity:,} {b.variety} sulur) is pending Management Quality Certification.",
                "action_suggested": "Inspect size grading (LPNM standard) and issue Management Quality Certificate.",
            })

    return {
        "total_batches": len(batches),
        "certified_batches": certified_batches,
        "total_available": total_available,
        "total_reserved": total_reserved,
        "total_planted": total_planted,
        "total_sold": total_sold,
        "total_damaged": total_damaged,
        "variety_breakdown": list(variety_breakdown.values()),
        "smart_alerts": alerts,
    }


# ==============================================================================
# 2. SULUR BATCH REGISTRY & CERTIFICATION CRUD
# ==============================================================================
@router.get("/batches", response_model=schemas.SulurBatchListResponse)
def list_sulur_batches(
    variety: Optional[str] = None,
    size_grade: Optional[str] = None,
    stock_status: Optional[str] = None,
    is_certified: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sample_sulur_data(db, current_user.id)
    query = db.query(models.SulurBatch)
    if variety:
        query = query.filter(models.SulurBatch.variety == variety)
    if size_grade:
        query = query.filter(models.SulurBatch.size_grade == size_grade)
    if stock_status:
        query = query.filter(models.SulurBatch.stock_status == stock_status)
    if is_certified is not None:
        query = query.filter(models.SulurBatch.is_certified == is_certified)

    total = query.count()
    items = query.order_by(models.SulurBatch.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items, "skip": skip, "limit": limit}


@router.post("/batches", response_model=schemas.SulurBatchResponse)
def create_sulur_batch(
    payload: schemas.SulurBatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_default_configs(db)
    count = db.query(models.SulurBatch).count() + 1
    batch_code = payload.batch_code or f"SLR-{payload.date_received.strftime('%Y%m')}-{payload.variety.upper()[:3]}-{count:03d}"

    if db.query(models.SulurBatch).filter(models.SulurBatch.batch_code == batch_code).first():
        batch_code = f"{batch_code}-{int(datetime.now().timestamp()) % 1000}"

    cert_num = None
    cert_date = None
    cert_by = None
    if payload.is_certified:
        cert_num = f"CERT-LPNM-SNF-{date.today().strftime('%Y')}-{count:04d}"
        cert_date = date.today()
        cert_by = payload.certified_by or (current_user.full_name or current_user.username)

    new_batch = models.SulurBatch(
        user_id=current_user.id,
        batch_code=batch_code,
        variety=payload.variety,
        sulur_type=payload.sulur_type,
        size_grade=payload.size_grade,
        initial_quantity=payload.initial_quantity,
        available_quantity=payload.initial_quantity,
        source_plot=payload.source_plot,
        storage_location=payload.storage_location,
        date_received=payload.date_received,
        treatment_status=payload.treatment_status,
        stock_status="available",
        is_certified=payload.is_certified,
        certificate_number=cert_num,
        certified_by=cert_by,
        certified_date=cert_date,
        quality_remarks=payload.quality_remarks,
    )
    recompute_batch_status(new_batch)
    db.add(new_batch)
    db.flush()

    # Log initial stock_in movement for complete traceability
    initial_movement = models.SulurMovement(
        batch_id=new_batch.id,
        user_id=current_user.id,
        movement_type="stock_in",
        quantity=payload.initial_quantity,
        destination_or_plot=payload.storage_location,
        movement_date=payload.date_received,
        remarks=f"Initial batch registration from {payload.source_plot} ({payload.size_grade})",
    )
    db.add(initial_movement)
    db.commit()
    db.refresh(new_batch)
    return new_batch


@router.put("/batches/{batch_id}", response_model=schemas.SulurBatchResponse)
def update_sulur_batch(
    batch_id: int,
    payload: schemas.SulurBatchUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    batch = db.query(models.SulurBatch).filter(models.SulurBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Sulur batch not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)

    if payload.is_certified and not batch.certificate_number:
        batch.certificate_number = f"CERT-LPNM-SNF-{date.today().strftime('%Y')}-{batch.id:04d}"
        batch.certified_date = date.today()
        batch.certified_by = payload.certified_by or (current_user.full_name or current_user.username)
    elif payload.is_certified is False:
        batch.certificate_number = None
        batch.certified_date = None
        batch.certified_by = None

    db.commit()
    db.refresh(batch)
    return batch


@router.post("/batches/{batch_id}/certify", response_model=schemas.SulurBatchResponse)
def certify_sulur_batch(
    batch_id: int,
    quality_remarks: Optional[str] = Query(None, description="Inspector verification remarks"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Issues an official Management & LPNM-aligned Seed Quality Certificate for a Sulur batch."""
    batch = db.query(models.SulurBatch).filter(models.SulurBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Sulur batch not found")

    batch.is_certified = True
    if not batch.certificate_number:
        batch.certificate_number = f"CERT-LPNM-SNF-{date.today().strftime('%Y')}-{batch.id:04d}"
    batch.certified_by = current_user.full_name or current_user.username
    batch.certified_date = date.today()
    if quality_remarks:
        batch.quality_remarks = quality_remarks
    if batch.treatment_status == "raw":
        batch.treatment_status = "ready_to_plant"

    db.commit()
    db.refresh(batch)
    return batch


# ==============================================================================
# 3. STOCK MOVEMENT LEDGER (TRACEABILITY)
# ==============================================================================
@router.get("/movements", response_model=List[schemas.SulurMovementResponse])
def list_sulur_movements(
    batch_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.SulurMovement)
    if batch_id:
        query = query.filter(models.SulurMovement.batch_id == batch_id)
    if movement_type:
        query = query.filter(models.SulurMovement.movement_type == movement_type)
    return query.order_by(models.SulurMovement.created_at.desc()).limit(limit).all()


@router.post("/movements", response_model=schemas.SulurMovementResponse)
def record_sulur_movement(
    payload: schemas.SulurMovementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    batch = db.query(models.SulurBatch).filter(models.SulurBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Sulur batch not found")

    m_type = payload.movement_type.lower()
    qty = payload.quantity

    if m_type == "stock_in":
        batch.available_quantity += qty
        batch.initial_quantity += qty
    elif m_type == "reserve":
        if batch.available_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient available sulur ({batch.available_quantity}) to reserve {qty}.")
        batch.available_quantity -= qty
        batch.reserved_quantity += qty
    elif m_type == "release_reserve":
        if batch.reserved_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Cannot release {qty}; only {batch.reserved_quantity} reserved.")
        batch.reserved_quantity -= qty
        batch.available_quantity += qty
    elif m_type == "plant":
        # Can plant from reserved first or directly from available
        if batch.available_quantity + batch.reserved_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock to plant {qty} sulur.")
        from_res = min(batch.reserved_quantity, qty)
        rem = qty - from_res
        batch.reserved_quantity -= from_res
        batch.available_quantity -= rem
        batch.planted_quantity += qty
    elif m_type in ("sell", "stock_out"):
        if batch.available_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient available stock ({batch.available_quantity}) for sales/outflow of {qty}.")
        batch.available_quantity -= qty
        batch.sold_quantity += qty
    elif m_type == "damage":
        if batch.available_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient available stock ({batch.available_quantity}) to mark {qty} as damaged.")
        batch.available_quantity -= qty
        batch.damaged_quantity += qty
    elif m_type == "transfer":
        if payload.destination_or_plot:
            batch.storage_location = payload.destination_or_plot
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported movement_type: {m_type}")

    recompute_batch_status(batch)

    movement = models.SulurMovement(
        batch_id=batch.id,
        user_id=current_user.id,
        movement_type=m_type,
        quantity=qty,
        destination_or_plot=payload.destination_or_plot,
        movement_date=payload.movement_date or date.today(),
        remarks=payload.remarks,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


# ==============================================================================
# 4. REFERENCE CONFIGURATIONS (LPNM / MPIB DENSITY, NUTRIENT & PRICING)
# ==============================================================================
@router.get("/reference-configs", response_model=List[schemas.SulurReferenceConfigResponse])
def get_reference_configs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return ensure_default_configs(db)


@router.put("/reference-configs/{variety}", response_model=schemas.SulurReferenceConfigResponse)
def update_reference_config(
    variety: str,
    payload: schemas.SulurReferenceConfigBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_default_configs(db)
    cfg = db.query(models.SulurReferenceConfig).filter(models.SulurReferenceConfig.variety == variety).first()
    if not cfg:
        cfg = models.SulurReferenceConfig(**payload.model_dump())
        db.add(cfg)
    else:
        for k, v in payload.model_dump().items():
            setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg


# ==============================================================================
# 5. SEED QUANTITY, NUTRIENT, PROFIT CALCULATOR & RULE-BASED DSS
# ==============================================================================
@router.post("/plans", response_model=schemas.SulurPlanResponse)
def create_and_evaluate_sulur_plan(
    payload: schemas.SulurPlanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Executes the exact formulas from Chapter 5 & Appendix 11.0 of Arif's Proposal Report:
    1. Required Sulur = Land Area (ha) x Planting Density (trees/ha) [+ optional mortality buffer]
    2. Nutrient Estimation = Based on required sulur & LPNM reference rates
    3. Revenue, Cost & Projected Profit Estimation
    4. Rule-Based Decision Support System (DSS) IF-THEN evaluation
    """
    ensure_default_configs(db)
    cfg = db.query(models.SulurReferenceConfig).filter(models.SulurReferenceConfig.variety == payload.variety).first()
    if not cfg:
        cfg = db.query(models.SulurReferenceConfig).first()

    density = payload.planting_density_ha or cfg.default_planting_density_ha
    base_sulur = int(round(payload.land_area_ha * density))
    buffer_sulur = int(round(base_sulur * (payload.mortality_buffer_percent / 100.0)))
    required_sulur = base_sulur + buffer_sulur

    # Check current available stock for this variety
    available_stock = (
        db.query(func.coalesce(func.sum(models.SulurBatch.available_quantity), 0))
        .filter(models.SulurBatch.variety == payload.variety)
        .scalar()
        or 0
    )
    shortfall = max(required_sulur - available_stock, 0)

    # Nutrient calculation
    units_1000 = required_sulur / 1000.0
    est_npk_kg = round(units_1000 * cfg.npk_fertilizer_kg_per_1000, 2)
    est_foliar_l = round(units_1000 * cfg.foliar_fertilizer_l_per_1000, 2)

    # Cost & Revenue Calculation (supports exact Appendix 11.0 custom override or database-driven LPNM defaults)
    sulur_cost = (
        payload.custom_sulur_cost_rm
        if payload.custom_sulur_cost_rm is not None
        else round(shortfall * cfg.sulur_unit_cost_rm if shortfall > 0 else required_sulur * cfg.sulur_unit_cost_rm, 2)
    )
    approved_nutrient_budget = round(units_1000 * cfg.nutrient_cost_per_1000_rm, 2)
    nutrient_cost = (
        payload.custom_nutrient_cost_rm
        if payload.custom_nutrient_cost_rm is not None
        else approved_nutrient_budget
    )
    operational_cost = (
        payload.custom_operational_cost_rm
        if payload.custom_operational_cost_rm is not None
        else round(payload.land_area_ha * cfg.operational_cost_per_ha_rm, 2)
    )
    total_cost = round(sulur_cost + nutrient_cost + operational_cost, 2)

    if payload.custom_selling_price_rm is not None and payload.custom_selling_price_rm > 100:
        # User entered total expected revenue directly (like Appendix 11.0: RM 30,000)
        estimated_revenue = round(payload.custom_selling_price_rm, 2)
    elif payload.plan_mode == "sulur_sales":
        unit_price = payload.custom_selling_price_rm or cfg.sulur_selling_price_rm
        estimated_revenue = round(required_sulur * unit_price, 2)
    else:
        # Cultivation harvest revenue (assume 90% marketable fruit yield)
        fruit_price_kg = payload.custom_selling_price_rm or cfg.fruit_selling_price_rm_kg
        harvested_plants = base_sulur * 0.90
        estimated_revenue = round(harvested_plants * cfg.avg_fruit_weight_kg * fruit_price_kg, 2)

    projected_profit = round(estimated_revenue - total_cost, 2)
    roi_percent = round((projected_profit / total_cost) * 100.0, 2) if total_cost > 0 else 0.0

    # ==========================================================================
    # RULE-BASED DECISION SUPPORT (Chapter 5.2.5 IF-THEN Rules)
    # ==========================================================================
    recommendations = []

    # Rule 1: Stock sufficiency check
    if available_stock < required_sulur:
        recommendations.append({
            "rule_code": "INSUFFICIENT_SULUR_STOCK",
            "severity": "critical",
            "category": "stock",
            "message": f"Insufficient sulur stock for the selected planting plan. Required: {required_sulur:,} ({payload.variety}), Available: {available_stock:,} (Shortfall: {shortfall:,} sulur).",
            "action_suggested": f"Procure {shortfall:,} certified {payload.variety} sulur or reduce planned land area to {round(available_stock / density, 2)} ha.",
        })
    else:
        recommendations.append({
            "rule_code": "SUFFICIENT_SULUR_STOCK",
            "severity": "optimal",
            "category": "stock",
            "message": f"Sufficient {payload.variety} sulur stock available ({available_stock:,} in nursery vs {required_sulur:,} required).",
            "action_suggested": "Reserve the required sulur batches in the Stock Movement Ledger to lock allocation.",
        })

    # Rule 2: Financial & Profit check
    if estimated_revenue < total_cost:
        recommendations.append({
            "rule_code": "PROJECTED_LOSS_DETECTED",
            "severity": "critical",
            "category": "profit",
            "message": f"Projected loss detected (RM {projected_profit:,.2f}). Please review selling price or estimated costs.",
            "action_suggested": "Verify LPNM selling price reference or optimize operational/seed procurement costs before proceeding.",
        })
    elif roi_percent < 20.0:
        recommendations.append({
            "rule_code": "LOW_PROFIT_MARGIN",
            "severity": "warning",
            "category": "profit",
            "message": f"Low projected profit margin detected (ROI: {roi_percent}% / Profit: RM {projected_profit:,.2f}).",
            "action_suggested": "Consider using internal farm-propagated sulur suckers to reduce seed acquisition cost.",
        })
    else:
        recommendations.append({
            "rule_code": "HEALTHY_PROFIT_PROJECTION",
            "severity": "optimal",
            "category": "profit",
            "message": f"Financially viable plan with projected profit of RM {projected_profit:,.2f} (ROI: {roi_percent}%).",
            "action_suggested": "Proceed with cultivation schedule and export PDF report for Farm Manager sign-off.",
        })

    # Rule 3: Nutrient Cost threshold check
    if nutrient_cost > approved_nutrient_budget * 1.10:
        recommendations.append({
            "rule_code": "HIGH_NUTRIENT_COST",
            "severity": "warning",
            "category": "nutrient",
            "message": f"High nutrient cost detected (RM {nutrient_cost:,.2f} exceeds MPIB reference budget of RM {approved_nutrient_budget:,.2f}). Please review the nutrient requirement.",
            "action_suggested": f"Align fertilizer purchase with MPIB standard ({est_npk_kg} kg NPK & {est_foliar_l} L foliar).",
        })

    # Rule 4: Remaining stock threshold alert
    remaining_after_plan = max(available_stock - required_sulur, 0)
    if remaining_after_plan < cfg.min_stock_threshold:
        recommendations.append({
            "rule_code": "LOW_POST_PLAN_STOCK_ALERT",
            "severity": "warning",
            "category": "stock",
            "message": f"Low stock alert after allocation ({remaining_after_plan:,} sulur remaining vs {cfg.min_stock_threshold:,} minimum level). Consider updating seed inventory or planning new stock.",
            "action_suggested": "Schedule post-harvest sucker (sulur tangkai) collection from mature plots.",
        })

    plan_record = models.SulurPlanRecord(
        user_id=current_user.id,
        plan_title=payload.plan_title,
        variety=payload.variety,
        plan_mode=payload.plan_mode,
        land_area_ha=payload.land_area_ha,
        planting_density_ha=density,
        mortality_buffer_percent=payload.mortality_buffer_percent,
        required_sulur=required_sulur,
        available_sulur_at_plan=available_stock,
        stock_shortfall=shortfall,
        estimated_npk_kg=est_npk_kg,
        estimated_foliar_liters=est_foliar_l,
        sulur_cost_rm=sulur_cost,
        nutrient_cost_rm=nutrient_cost,
        operational_cost_rm=operational_cost,
        total_cost_rm=total_cost,
        estimated_revenue_rm=estimated_revenue,
        projected_profit_rm=projected_profit,
        roi_percent=roi_percent,
        recommendations_json=json.dumps(recommendations),
    )
    db.add(plan_record)
    db.commit()
    db.refresh(plan_record)

    resp = schemas.SulurPlanResponse.model_validate(plan_record)
    resp.recommendations = [schemas.SulurRecommendationItem(**r) for r in recommendations]
    return resp


@router.get("/plans", response_model=List[schemas.SulurPlanResponse])
def list_sulur_plans(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    plans = db.query(models.SulurPlanRecord).order_by(models.SulurPlanRecord.created_at.desc()).limit(limit).all()
    results = []
    for p in plans:
        item = schemas.SulurPlanResponse.model_validate(p)
        try:
            raw_recs = json.loads(p.recommendations_json or "[]")
            item.recommendations = [schemas.SulurRecommendationItem(**r) for r in raw_recs]
        except Exception:
            item.recommendations = []
        results.append(item)
    return results


# ==============================================================================
# 6. DOWNLOADABLE PDF GENERATORS (MANAGEMENT QUALITY CERTIFICATE & FULL REPORT)
# ==============================================================================
@router.get("/batches/{batch_id}/certificate.pdf")
def download_sulur_quality_certificate_pdf(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generates a formal Management & LPNM-aligned Sulur Seed Quality Certificate PDF (ReportLab)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas

    batch = db.query(models.SulurBatch).filter(models.SulurBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Sulur batch not found")

    if not batch.is_certified:
        batch.is_certified = True
        batch.certificate_number = f"CERT-LPNM-SNF-{date.today().strftime('%Y')}-{batch.id:04d}"
        batch.certified_by = current_user.full_name or current_user.username
        batch.certified_date = date.today()
        db.commit()
        db.refresh(batch)

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Decorative Border
    c.setStrokeColor(colors.HexColor("#15803d"))
    c.setLineWidth(4)
    c.rect(30, 30, width - 60, height - 60)
    c.setLineWidth(1)
    c.rect(38, 38, width - 76, height - 76)

    # Header Banner
    c.setFillColor(colors.HexColor("#14532d"))
    c.rect(38, height - 130, width - 76, 92, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 75, "PINETRACK V2.0 - SERI NANAS FARM SDN. BHD.")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 98, "OFFICIAL PINEAPPLE SEED (SULUR) QUALITY & TRACEABILITY CERTIFICATE")
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(width / 2, height - 115, "Aligned with Malaysian Pineapple Industry Board (LPNM / MPIB) Planting Material Standards")

    # Certificate Number Badge
    c.setFillColor(colors.HexColor("#fef9c3"))
    c.setStrokeColor(colors.HexColor("#ca8a04"))
    c.roundRect(width / 2 - 140, height - 185, 280, 36, 6, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#854d0e"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, height - 171, f"CERTIFICATE NO: {batch.certificate_number}")

    # Body Content
    y = height - 230
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2, y, "This is to certify that the following pineapple planting material (sulur) batch has been")
    c.drawCentredString(width / 2, y - 16, "inspected, graded by size for uniform cultivation, and verified for farm deployment:")

    # Details Table Box
    y_box = y - 240
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.roundRect(65, y_box, width - 130, 195, 8, fill=1, stroke=1)

    fields = [
        ("Batch Identification Code:", batch.batch_code),
        ("Pineapple Variety:", f"{batch.variety} (Ananas comosus L.)"),
        ("Planting Material Type:", batch.sulur_type.upper()),
        ("Size & Grading Classification:", f"{batch.size_grade} (Uniform Growth Standard)"),
        ("Source / Parent Plot Origin:", batch.source_plot),
        ("Current Nursery Location:", batch.storage_location),
        ("Date Received / Harvested:", str(batch.date_received)),
        ("Phytosanitary / Treatment Status:", batch.treatment_status.replace("_", " ").upper()),
        ("Initial / Available Quantity:", f"{batch.initial_quantity:,} sulur / {batch.available_quantity:,} sulur available"),
    ]

    row_y = y_box + 170
    for label, val in fields:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(85, row_y, label)
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(275, row_y, str(val))
        row_y -= 19

    # Quality Remarks
    y_rem = y_box - 55
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#14532d"))
    c.drawString(65, y_rem + 25, "Management Quality & Inspection Remarks:")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#334155"))
    remarks_text = batch.quality_remarks or "Healthy parent plant origin verified. Uniform size grading confirmed according to LPNM guidelines."
    c.drawString(65, y_rem + 8, remarks_text[:95])

    # Signatures
    sig_y = 110
    c.setStrokeColor(colors.HexColor("#64748b"))
    c.line(75, sig_y, 245, sig_y)
    c.line(width - 245, sig_y, width - 75, sig_y)

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.drawCentredString(160, sig_y - 16, batch.certified_by or "Farm Manager / Admin")
    c.drawCentredString(width - 160, sig_y - 16, "Seri Nanas Farm Sdn. Bhd.")

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawCentredString(160, sig_y - 30, f"Certified Date: {batch.certified_date or date.today()}")
    c.drawCentredString(width - 160, sig_y - 30, "Management Verification Stamp")

    c.showPage()
    c.save()
    buffer.seek(0)

    filename = f"Sulur_Certificate_{batch.batch_code}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
