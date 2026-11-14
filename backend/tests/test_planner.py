"""
Tests for FR12: Harvest & Profit Planner
"""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Base, engine, SessionLocal, get_db, is_sqlite
from app.main import app
from app.models import Harvest, User
from app.services.auth_service import create_access_token
from app.services.planner_service import PlannerError, PlannerService


@pytest.fixture
def db_session():
    assert is_sqlite, "Tests must run against the throwaway SQLite database set up in conftest.py"
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    if previous:
        app.dependency_overrides[get_db] = previous
    else:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def users(db_session):
    made = {}
    for username, role in (("admin", "admin"), ("hazriq", "worker")):
        user = User(username=username, email=f"{username}@test.com", password_hash="x", full_name=username, role=role)
        db_session.add(user)
        made[username] = user
    db_session.commit()
    return made


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


BASE = {
    "selling_price_per_kg": 3.5,
    "variable_cost_per_kg": 1.5,
    "fixed_cost": 2000,
    "marketable_yield_percent": 80,
    "productivity_kg_per_ha": 40000,
}


def target(**kw):
    return {"mode": "target_profit", **BASE, "target_profit": 10000, **kw}


def forecast(**kw):
    return {"mode": "forecast", **BASE, **kw}


# ── 1, 3, 4: target profit ───────────────────────────────────────────────────

def test_target_profit_plan():
    r = PlannerService.calculate(target())
    # (10,000 + 2,000) / (3.50 - 1.50) = 6,000 marketable kg; / 0.8 = 7,500 kg harvested
    assert r["marketable_kg"] == 6000.0
    assert r["harvest_kg"] == 7500.0
    assert r["land_ha"] == 0.188  # 7,500 / 40,000 = 0.1875, rounded up
    assert r["revenue"] == 21000.0
    assert r["variable_cost"] == 9000.0
    assert r["total_cost"] == 11000.0
    assert r["profit"] == 10000.0
    assert r["profit_margin_percent"] == 47.62
    assert r["break_even_marketable_kg"] == 1000.0


def test_target_quantities_round_up_and_still_meet_target():
    r = PlannerService.calculate(target(target_profit=1000, fixed_cost=0, selling_price_per_kg=3, variable_cost_per_kg=0))
    assert r["marketable_kg"] == 333.34  # 333.333... rounded up
    assert r["profit"] == 1000.0


def test_zero_target_gives_break_even():
    r = PlannerService.calculate(target(target_profit=0))
    assert r["marketable_kg"] == 1000.0
    assert r["profit"] == 0.0


def test_target_rejected_when_price_not_above_variable_cost():
    with pytest.raises(PlannerError, match="must be higher than the variable cost"):
        PlannerService.calculate(target(selling_price_per_kg=1.5))


# ── 2, 5, 6: forecast ────────────────────────────────────────────────────────

def test_forecast_from_harvest_quantity():
    r = PlannerService.calculate(forecast(planned_harvest_kg=10000))
    assert r["marketable_kg"] == 8000.0
    assert r["land_ha"] == 0.25
    assert r["revenue"] == 28000.0
    assert r["total_cost"] == 14000.0
    assert r["profit"] == 14000.0
    assert r["profit_margin_percent"] == 50.0
    assert r["harvest_source"] == "planned_harvest"


def test_forecast_from_land_area():
    r = PlannerService.calculate(forecast(land_area_ha=2.5))
    assert r["harvest_kg"] == 100000.0
    assert r["land_ha"] == 2.5
    assert r["marketable_kg"] == 80000.0
    assert r["harvest_source"] == "land_area"


def test_forecast_loss_is_reported():
    r = PlannerService.calculate(forecast(planned_harvest_kg=500))
    # 400 kg x 3.50 = 1,400 revenue; 2,000 + 600 = 2,600 cost
    assert r["profit"] == -1200.0
    assert r["profit_margin_percent"] == -85.71
    assert any("loss" in n for n in r["notes"])


def test_forecast_with_price_below_cost_warns():
    r = PlannerService.calculate(forecast(planned_harvest_kg=1000, variable_cost_per_kg=4))
    assert r["break_even_marketable_kg"] is None
    assert r["profit"] < 0
    assert any("adds to the loss" in n for n in r["notes"])


# ── 8: decimal precision ─────────────────────────────────────────────────────

def test_decimal_money_is_exact():
    r = PlannerService.calculate(forecast(planned_harvest_kg=0.3, selling_price_per_kg=0.1,
                                          variable_cost_per_kg=0, fixed_cost=0, marketable_yield_percent=100))
    assert r["revenue"] == 0.03  # float arithmetic would give 0.030000000000000002


# ── 7, 11: API validation and access ─────────────────────────────────────────

def test_api_calculates_for_admin(client, users):
    res = client.post("/api/planner/calculate", headers=auth(users["admin"]), json=target())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["harvest_kg"] == 7500.0
    assert body["calculation_version"] == "fr12-v1"
    assert body["steps"][0]["working"].startswith("(RM 10,000.00 + RM 2,000.00)")
    assert "not a guaranteed" in body["disclaimer"]


def test_workers_cannot_use_the_planner(client, users):
    for path, method in (("/api/planner/calculate", "post"), ("/api/planner/compare", "post"),
                         ("/api/planner/historical-yield", "get")):
        kwargs = {"json": target()} if method == "post" else {}
        res = getattr(client, method)(path, headers=auth(users["hazriq"]), **kwargs)
        assert res.status_code == 403, path
    assert client.post("/api/planner/calculate", json=target()).status_code in (401, 403)


@pytest.mark.parametrize("body", [
    target(productivity_kg_per_ha=0),
    target(marketable_yield_percent=0),
    target(marketable_yield_percent=120),
    target(selling_price_per_kg=0),
    target(fixed_cost=-1),
    target(variable_cost_per_kg=-0.5),
    target(target_profit=-100),
    {k: v for k, v in target().items() if k != "target_profit"},
    forecast(),
    forecast(planned_harvest_kg=1000, land_area_ha=2),
    forecast(planned_harvest_kg=0),
])
def test_invalid_inputs_are_rejected(client, users, body):
    res = client.post("/api/planner/calculate", headers=auth(users["admin"]), json=body)
    assert res.status_code == 422, res.text


def test_impossible_target_returns_400(client, users):
    res = client.post("/api/planner/calculate", headers=auth(users["admin"]), json=target(variable_cost_per_kg=4))
    assert res.status_code == 400
    assert "must be higher" in res.json()["detail"]


# ── 12: scenarios ────────────────────────────────────────────────────────────

def test_scenario_comparison(client, users):
    res = client.post("/api/planner/compare", headers=auth(users["admin"]), json={"scenarios": [
        {"label": "Conservative", "inputs": target(selling_price_per_kg=3, marketable_yield_percent=75)},
        {"label": "Expected", "inputs": target()},
        {"label": "Optimistic", "inputs": target(selling_price_per_kg=1)},
    ]})
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert [i["label"] for i in items] == ["Conservative", "Expected", "Optimistic"]
    # (10,000 + 2,000) / 1.50 = 8,000 marketable; / 0.75 = 10,666.67 kg (rounded up)
    assert items[0]["result"]["harvest_kg"] == 10666.67
    assert items[1]["result"]["harvest_kg"] == 7500.0
    assert items[2]["result"] is None and "must be higher" in items[2]["error"]


# ── 9, 10: historical yield ──────────────────────────────────────────────────

def _graded(client, admin, kg, grades, rejected=0, days_ago=5):
    res = client.post("/api/harvest", headers=auth(admin), json={
        "field_name": "F", "harvest_date": str(date.today() - timedelta(days=days_ago)), "quantity_kg": kg, "grades": grades,
    })
    assert res.status_code == 201, res.text
    if rejected:
        client.patch(f"/api/harvest/{res.json()['id']}", headers=auth(admin), json={"rejected_kg": rejected})


def test_historical_yield_needs_enough_graded_batches(client, users):
    admin = users["admin"]
    _graded(client, admin, 100, {"A": 100}, rejected=10)
    res = client.get("/api/planner/historical-yield", headers=auth(admin)).json()
    assert res["available"] is False
    assert res["marketable_yield_percent"] is None
    assert res["included_batches"] == 1
    assert "at least 3" in res["message"]


def test_historical_yield_is_weighted_and_excludes_legacy(client, users, db_session):
    admin = users["admin"]
    _graded(client, admin, 1000, {"A": 1000}, rejected=100)    # 900 marketable
    _graded(client, admin, 100, {"B": 100}, rejected=50)       # 50 marketable
    _graded(client, admin, 100, {"C": 100})                    # 100 marketable
    _graded(client, admin, 100, {"A": 100}, days_ago=500)      # outside 12 months
    db_session.add(Harvest(user_id=admin.id, batch_number="PT-OLD", field_name="Old", harvest_date=date.today(),
                           quantity_kg=500, quality_grade="A", harvest_status="graded", spoilage_kg=0, rejected_kg=400))
    db_session.commit()

    res = client.get("/api/planner/historical-yield", headers=auth(admin)).json()
    assert res["available"] is True
    assert res["included_batches"] == 3
    assert res["excluded_legacy_batches"] == 1
    # (900 + 50 + 100) / 1200 = 87.5%, not the unweighted mean (90 + 50 + 100) / 3 = 80%
    assert res["marketable_yield_percent"] == 87.5

    # The historical figure is only a default; any value can be used instead
    manual = client.post("/api/planner/calculate", headers=auth(admin), json=target(marketable_yield_percent=60)).json()
    historic = client.post("/api/planner/calculate", headers=auth(admin),
                           json=target(marketable_yield_percent=res["marketable_yield_percent"])).json()
    assert manual["harvest_kg"] == 10000.0
    assert historic["harvest_kg"] == 6857.15  # 6,000 / 0.875 = 6,857.142..., rounded up


def test_planner_writes_nothing(client, users, db_session):
    before = db_session.query(Harvest).count()
    client.post("/api/planner/calculate", headers=auth(users["admin"]), json=forecast(planned_harvest_kg=5000))
    client.get("/api/planner/historical-yield", headers=auth(users["admin"]))
    assert db_session.query(Harvest).count() == before


# ── What-if scenarios ────────────────────────────────────────────────────────

def test_what_if_target_keeps_target_and_varies_harvest(client, users):
    res = client.post("/api/planner/what-if", headers=auth(users["admin"]), json=target())
    assert res.status_code == 200, res.text
    body = res.json()
    by = {s["label"]: s for s in body["scenarios"]}
    assert list(by) == ["Conservative", "Expected", "Optimistic"]

    # Expected is the main plan, unchanged
    main = PlannerService.calculate(target())
    assert by["Expected"]["result"]["harvest_kg"] == main["harvest_kg"] == 7500.0
    assert by["Expected"]["inputs"]["selling_price_per_kg"] == 3.5

    # Conservative: price 3.15, variable 1.65, fixed 2,200, yield 75%, productivity 36,000
    c = by["Conservative"]
    assert c["inputs"] == {"selling_price_per_kg": 3.15, "variable_cost_per_kg": 1.65, "fixed_cost": 2200.0,
                           "marketable_yield_percent": 75.0, "productivity_kg_per_ha": 36000.0}
    # (10,000 + 2,200) / 1.50 = 8,133.33 marketable; / 0.75 = 10,844.45 kg
    assert c["result"]["harvest_kg"] == 10844.45
    assert c["result"]["profit"] == 10000.0  # same target in every scenario

    o = by["Optimistic"]["result"]
    assert o["profit"] == 10000.0
    assert o["harvest_kg"] < 7500.0 < c["result"]["harvest_kg"]
    assert by["Optimistic"]["inputs"]["marketable_yield_percent"] == 85.0

    assert {r["field"] for r in body["rules"]} == {
        "selling_price_per_kg", "variable_cost_per_kg", "fixed_cost", "marketable_yield_percent", "productivity_kg_per_ha"}
    assert "not predictions" in body["note"]


def test_what_if_forecast_keeps_harvest_and_varies_profit(client, users):
    body = client.post("/api/planner/what-if", headers=auth(users["admin"]),
                       json=forecast(planned_harvest_kg=10000)).json()
    results = [s["result"] for s in body["scenarios"]]
    assert all(r["harvest_kg"] == 10000.0 for r in results)
    assert results[1]["profit"] == 14000.0
    assert results[0]["profit"] < results[1]["profit"] < results[2]["profit"]
    # Land differs because productivity is adjusted: 10,000 / 36,000 and 10,000 / 44,000
    assert results[0]["land_ha"] == 0.278 and results[2]["land_ha"] == 0.227


def test_what_if_unreachable_scenario_reports_error(client, users):
    # Conservative price 1.80 < conservative variable cost 1.87: the target cannot be reached
    body = client.post("/api/planner/what-if", headers=auth(users["admin"]),
                       json=target(selling_price_per_kg=2, variable_cost_per_kg=1.7)).json()
    by = {s["label"]: s for s in body["scenarios"]}
    assert by["Conservative"]["result"] is None and "must be higher" in by["Conservative"]["error"]
    assert by["Expected"]["result"] is not None


def test_what_if_yield_stays_within_range():
    body = PlannerService.what_if(forecast(planned_harvest_kg=100, marketable_yield_percent=98))
    assert body["scenarios"][2]["inputs"]["marketable_yield_percent"] == 100.0
    body = PlannerService.what_if(forecast(planned_harvest_kg=100, marketable_yield_percent=3))
    assert body["scenarios"][0]["inputs"]["marketable_yield_percent"] == 1.0


def test_what_if_is_admin_only(client, users):
    assert client.post("/api/planner/what-if", headers=auth(users["hazriq"]), json=target()).status_code == 403
