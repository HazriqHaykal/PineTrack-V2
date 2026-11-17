"""
Tests for FR08 (grading breakdown) and FR09 (marketable yield)
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.config import Base, engine, SessionLocal, get_db, is_sqlite
from app.main import app
from app.models import BatchEvent, Harvest, HarvestGrade, MarketabilityPolicy, User, Waste
from app.services.auth_service import create_access_token
from app.services.yield_calc import compute_yield, farm_yield


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
    for username, role in (("admin", "admin"), ("hazriq", "worker"), ("arif", "worker")):
        user = User(username=username, email=f"{username}@test.com", password_hash="x",
                    full_name=username.title(), role=role)
        db_session.add(user)
        made[username] = user
    db_session.commit()
    return made


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


EXAMPLE = {"A": 100, "B": 60, "C": 25, "D": 15}


def create(client, user, kg=200.0, grades=EXAMPLE, **extra):
    body = {"field_name": "Block A-1", "harvest_date": str(date.today()), "quantity_kg": kg, **extra}
    if grades is not None:
        body["grades"] = grades
    return client.post("/api/harvest", headers=auth(user), json=body)


def set_policy(client, admin, grades):
    res = client.put("/api/harvest/policy/marketability", headers=auth(admin), json={"marketable_grades": grades})
    assert res.status_code == 200, res.text
    return res.json()


def details(client, user, batch_id):
    res = client.get(f"/api/harvest/{batch_id}/details", headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()


def transport(client, user, batch_id, weight, status="pending"):
    res = client.post("/api/transport", headers=auth(user), json={
        "harvest_id": batch_id, "destination": "Market", "scheduled_date": str(date.today()),
        "cargo_weight_kg": weight, "status": status,
    })
    assert res.status_code == 201, res.text
    return res.json()


# ── 1, 5, 6: recording grades and calculating the yield ──────────────────────

def test_farmer_records_grade_quantities_and_gets_yield(client, users):
    res = create(client, users["hazriq"])
    assert res.status_code == 201, res.text
    h = res.json()
    assert h["grading_basis"] == "grade_based"
    assert h["grade_quantities"] == {"A": 100.0, "B": 60.0, "C": 25.0, "D": 15.0}
    # Every grade, D included, is marketable by default
    assert h["marketable_grades"] == ["A", "B", "C", "D"]
    assert h["graded_marketable_kg"] == 200.0
    assert h["non_marketable_kg"] == 0.0
    assert h["marketable_yield_kg"] == 200.0
    assert h["marketable_yield_percent"] == 100.0
    assert h["quality_grade"] == "mixed"
    assert h["harvest_status"] == "graded"
    assert h["rejected_kg"] == 0.0
    assert h["grading_policy_version"] == 1


def test_spoilage_and_rejection_come_out_of_the_grades(client, users):
    """FR09 example: 15 kg of the batch rejected by the farmer gives 185 kg / 92.5%"""
    h = create(client, users["hazriq"]).json()
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"rejected_kg": 15})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["marketable_yield_kg"] == 185.0
    assert body["marketable_yield_percent"] == 92.5
    assert body["grading_yield_percent"] == 100.0

    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"spoilage_kg": 5})
    assert res.json()["marketable_yield_kg"] == 180.0

    q = details(client, users["admin"], h["id"])["quantities"]
    assert q["marketable_kg"] == 180.0
    assert q["recorded_losses_kg"] == 20.0

    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"spoilage_kg": 190})
    assert res.status_code == 400
    assert "cannot exceed the marketable graded quantity" in res.json()["detail"]


def test_single_grade_batch_keeps_its_letter(client, users):
    h = create(client, users["hazriq"], kg=50, grades={"A": 50}).json()
    assert h["quality_grade"] == "A"
    assert h["grade_quantities"] == {"A": 50.0, "B": 0.0, "C": 0.0, "D": 0.0}
    assert h["marketable_yield_percent"] == 100.0


def test_no_duplicate_grade_rows(client, users, db_session):
    h = create(client, users["hazriq"]).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]),
                 json={"grades": {"A": 120, "B": 40, "C": 25, "D": 15}})
    rows = db_session.query(HarvestGrade).filter(HarvestGrade.harvest_id == h["id"]).all()
    assert sorted(r.grade for r in rows) == ["A", "B", "C", "D"]


# ── 2, 3, 7: validation ──────────────────────────────────────────────────────

@pytest.mark.parametrize("grades, message", [
    ({"A": 100, "B": 60, "C": 25}, "still to grade"),
    ({"A": 150, "B": 60, "C": 25, "D": 15}, "too much"),
    ({"A": 250}, "cannot exceed"),
    ({"A": -5, "B": 205}, "negative"),
    ({"E": 200}, "Unknown grade"),
    ({}, "at least one grade"),
    ({"A": 0, "B": 0}, "at least one grade"),
])
def test_invalid_breakdowns_are_rejected(client, users, grades, message):
    res = create(client, users["hazriq"], grades=grades)
    assert res.status_code == 400, res.text
    assert message in res.json()["detail"]


def test_decimal_quantities_reconcile_exactly(client, users):
    # 0.1 + 0.2 style sums must not fail on floating point
    res = create(client, users["hazriq"], kg=100.3, grades={"A": 50.1, "B": 30.1, "C": 10.05, "D": 10.05})
    assert res.status_code == 201, res.text
    h = res.json()
    assert h["marketable_yield_kg"] == 100.3
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"rejected_kg": 10.05})
    assert res.json()["marketable_yield_kg"] == 90.25
    assert res.json()["marketable_yield_percent"] == 89.98


def test_zero_marketable_batch(client, users):
    h = create(client, users["hazriq"], kg=40, grades={"D": 40}).json()
    assert h["marketable_yield_kg"] == 40.0  # Grade D is still sellable
    h = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"rejected_kg": 40}).json()
    assert h["marketable_yield_kg"] == 0.0
    assert h["marketable_yield_percent"] == 0.0
    assert details(client, users["hazriq"], h["id"])["lifecycle"]["code"] == "closed"


# ── 4, 10: ungraded and legacy batches ───────────────────────────────────────

def test_ungraded_batch_remains_supported(client, users):
    h = create(client, users["hazriq"], grades=None).json()
    assert h["grading_basis"] == "ungraded"
    assert h["grade_quantities"] is None
    assert h["grading_yield_percent"] is None
    assert h["harvest_status"] == "pending"
    # Missing grades are not treated as poor produce
    assert h["marketable_yield_kg"] == 200.0

    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"grades": EXAMPLE})
    assert res.status_code == 200, res.text
    assert res.json()["marketable_yield_kg"] == 200.0
    assert res.json()["harvest_status"] == "graded"


def test_legacy_batch_keeps_its_calculation(client, users, db_session):
    legacy = Harvest(user_id=users["hazriq"].id, batch_number="PT-2025-001", field_name="Old",
                     harvest_date=date(2025, 5, 1), quantity_kg=300, quality_grade="B",
                     harvest_status="graded", spoilage_kg=20, rejected_kg=10)
    db_session.add(legacy)
    db_session.commit()

    h = client.get(f"/api/harvest/{legacy.id}", headers=auth(users["hazriq"])).json()
    assert h["grading_basis"] == "legacy"
    assert h["grade_quantities"] is None
    assert h["marketable_yield_kg"] == 270.0  # 300 - 20 - 10, unchanged
    assert h["quality_grade"] == "B"

    d = details(client, users["admin"], legacy.id)
    assert d["grading"]["basis"] == "legacy"
    assert d["grading"]["legacy_grade"] == "B"
    assert d["grading"]["grades"] == []

    # Legacy rejected/spoilage edits work as before
    res = client.patch(f"/api/harvest/{legacy.id}", headers=auth(users["admin"]), json={"rejected_kg": 30})
    assert res.status_code == 200
    assert res.json()["marketable_yield_kg"] == 250.0


def test_legacy_batch_can_be_converted_to_grade_based(client, users, db_session):
    legacy = Harvest(user_id=users["hazriq"].id, batch_number="PT-2025-002", field_name="Old",
                     harvest_date=date(2025, 5, 1), quantity_kg=200, quality_grade="A",
                     harvest_status="graded", spoilage_kg=0, rejected_kg=30)
    db_session.add(legacy)
    db_session.commit()

    res = client.patch(f"/api/harvest/{legacy.id}", headers=auth(users["admin"]), json={"grades": EXAMPLE})
    assert res.status_code == 200, res.text
    h = res.json()
    assert h["grading_basis"] == "grade_based"
    # The 30 kg already rejected is part of the graded fruit and is deducted once
    assert h["rejected_kg"] == 30.0
    assert h["marketable_yield_kg"] == 170.0

    event = db_session.query(BatchEvent).filter(BatchEvent.event_type == "grading_recorded").one()
    assert "replacing the single legacy Grade A" in event.description


# ── 11, 12: no double counting ───────────────────────────────────────────────

def test_excluded_grade_and_rejection_are_each_counted_once(client, users):
    set_policy(client, users["admin"], ["A", "B", "C"])
    h = create(client, users["hazriq"]).json()
    assert h["marketable_yield_kg"] == 185.0
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 10})
    body = res.json()
    assert body["marketable_yield_kg"] == 175.0  # 200 - 15 excluded Grade D - 10 rejected
    q = details(client, users["admin"], h["id"])["quantities"]
    assert q["non_marketable_kg"] == 15.0
    assert q["rejected_kg"] == 10.0
    assert q["recorded_losses_kg"] == 25.0

    # Rejection is limited to the marketable grades (185 kg)
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 186})
    assert res.status_code == 400


def test_waste_records_do_not_reduce_marketable_again(client, users):
    h = create(client, users["hazriq"]).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={"rejected_kg": 15})
    res = client.post("/api/waste", headers=auth(users["hazriq"]), json={
        "harvest_id": h["id"], "waste_type": "damaged", "quantity_kg": 15, "classification": "compostable",
    })
    assert res.status_code == 201, res.text
    q = details(client, users["admin"], h["id"])["quantities"]
    assert q["marketable_kg"] == 185.0
    assert q["available_kg"] == 185.0
    assert q["waste_recorded_kg"] == 15.0
    assert q["unclassified_losses_kg"] == 0.0


# ── 13, 14: transport ────────────────────────────────────────────────────────

def test_transport_uses_grade_based_marketable_quantity(client, users):
    h = create(client, users["hazriq"]).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 15})
    res = client.post("/api/transport", headers=auth(users["admin"]), json={
        "harvest_id": h["id"], "destination": "Market", "scheduled_date": str(date.today()), "cargo_weight_kg": 190,
    })
    assert res.status_code == 400
    assert "185 kg" in res.json()["detail"]
    transport(client, users["admin"], h["id"], 185)
    assert details(client, users["admin"], h["id"])["quantities"]["available_kg"] == 0.0


def test_grading_edit_cannot_strand_committed_transport(client, users, db_session):
    set_policy(client, users["admin"], ["A", "B", "C"])
    h = create(client, users["hazriq"]).json()
    t = transport(client, users["admin"], h["id"], 150)
    client.patch(f"/api/transport/{t['id']}", headers=auth(users["admin"]), json={"status": "delivered"})
    transport(client, users["admin"], h["id"], 30)  # 180 committed of 185

    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]),
                       json={"grades": {"A": 100, "B": 60, "C": 10, "D": 30}})
    assert res.status_code == 400
    assert "committed to transports" in res.json()["detail"]

    # Nothing was changed or deleted
    after = details(client, users["admin"], h["id"])
    assert after["batch"]["grade_quantities"]["D"] == 15.0
    assert len(after["transports"]["items"]) == 2
    assert after["quantities"]["delivered_kg"] == 150.0

    # A change that still covers the commitments is allowed
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]),
                       json={"grades": {"A": 100, "B": 60, "C": 22, "D": 18}})
    assert res.status_code == 200, res.text
    assert res.json()["marketable_yield_kg"] == 182.0

    # Rejection that would strand the commitments is refused too
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 5})
    assert res.status_code == 400


def test_cancelled_transport_frees_stock_for_regrading(client, users):
    set_policy(client, users["admin"], ["A", "B", "C"])
    h = create(client, users["hazriq"]).json()
    t = transport(client, users["admin"], h["id"], 180)
    client.patch(f"/api/transport/{t['id']}", headers=auth(users["admin"]), json={"status": "cancelled"})
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]),
                       json={"grades": {"A": 50, "B": 50, "C": 0, "D": 100}})
    assert res.status_code == 200, res.text


# ── 8, 9: access ─────────────────────────────────────────────────────────────

def test_farmer_sees_own_grading_but_not_others(client, users):
    mine = create(client, users["hazriq"]).json()
    theirs = create(client, users["arif"]).json()
    assert details(client, users["hazriq"], mine["id"])["grading"]["marketable_kg"] == 200.0
    assert client.get(f"/api/harvest/{theirs['id']}/details", headers=auth(users["hazriq"])).status_code == 403
    assert client.patch(f"/api/harvest/{theirs['id']}", headers=auth(users["hazriq"]),
                        json={"grades": {"A": 200}}).status_code == 403

    listed = client.get("/api/harvest", headers=auth(users["hazriq"])).json()["items"]
    assert [h["id"] for h in listed] == [mine["id"]]


def test_admin_sees_every_breakdown(client, users):
    create(client, users["hazriq"])
    create(client, users["arif"], grades={"A": 200})
    items = client.get("/api/harvest", headers=auth(users["admin"])).json()["items"]
    assert len(items) == 2
    assert all(h["grade_quantities"] is not None for h in items)


# ── Policy ───────────────────────────────────────────────────────────────────

def test_policy_change_does_not_alter_graded_batches(client, users, db_session):
    first = create(client, users["hazriq"]).json()
    assert first["marketable_yield_kg"] == 200.0

    res = client.put("/api/harvest/policy/marketability", headers=auth(users["hazriq"]),
                     json={"marketable_grades": ["A", "B"]})
    assert res.status_code == 403  # admin only

    res = client.put("/api/harvest/policy/marketability", headers=auth(users["admin"]),
                     json={"marketable_grades": ["A", "B"], "note": "Grade C goes to processing"})
    assert res.status_code == 200, res.text
    assert res.json()["version"] == 2
    assert res.json()["non_marketable_grades"] == ["C", "D"]

    # The earlier batch keeps v1
    old = client.get(f"/api/harvest/{first['id']}", headers=auth(users["admin"])).json()
    assert old["marketable_yield_kg"] == 200.0
    assert old["grading_policy_version"] == 1

    # New grading uses v2
    new = create(client, users["hazriq"]).json()
    assert new["marketable_yield_kg"] == 160.0
    assert new["grading_policy_version"] == 2

    # Re-grading the old batch applies the current policy, and says so
    res = client.patch(f"/api/harvest/{first['id']}", headers=auth(users["admin"]),
                       json={"grades": {"A": 110, "B": 50, "C": 25, "D": 15}})
    assert res.json()["marketable_yield_kg"] == 160.0
    event = db_session.query(BatchEvent).filter(
        BatchEvent.batch_id == first["id"], BatchEvent.event_type == "grading_updated").one()
    assert "policy v2" in event.description and "previously v1" in event.description

    history = client.get("/api/harvest/policy/marketability/history", headers=auth(users["admin"])).json()
    assert [p["version"] for p in history] == [2, 1]
    assert history[0]["created_by"] == "Admin"


def test_policy_needs_a_marketable_grade(client, users):
    res = client.put("/api/harvest/policy/marketability", headers=auth(users["admin"]), json={"marketable_grades": []})
    assert res.status_code == 400
    res = client.put("/api/harvest/policy/marketability", headers=auth(users["admin"]), json={"marketable_grades": ["Z"]})
    assert res.status_code == 400


def test_worker_can_read_policy(client, users):
    res = client.get("/api/harvest/policy/marketability", headers=auth(users["hazriq"]))
    assert res.status_code == 200
    assert res.json()["marketable_grades"] == ["A", "B", "C", "D"]


# ── 15: farm-wide yield ──────────────────────────────────────────────────────

def test_farm_yield_is_quantity_weighted():
    big = compute_yield(1000, 0, 0, [("A", 900, True), ("D", 100, False)])
    small = compute_yield(10, 0, 0, [("A", 1, True), ("D", 9, False)])
    legacy = compute_yield(500, 0, 50, None, "A")
    result = farm_yield([big, small, legacy])
    # (900 + 1) / (1000 + 10) = 89.21%, not the unweighted mean (90 + 10) / 2 = 50%
    assert result["marketable_yield_percent"] == 89.21
    assert result["graded_batches"] == 2
    assert result["legacy_batches"] == 1
    assert result["legacy_kg"] == 500.0
    assert result["grade_kg"]["A"] == 901.0


def test_statistics_and_analytics_report_graded_yield(client, users):
    set_policy(client, users["admin"], ["A", "B", "C"])
    create(client, users["hazriq"])
    create(client, users["hazriq"], kg=100, grades={"A": 40, "D": 60})
    create(client, users["hazriq"], grades=None)

    stats = client.get("/api/harvest/statistics/summary", headers=auth(users["admin"])).json()
    g = stats["grading"]
    assert g["graded_batches"] == 2
    assert g["ungraded_batches"] == 1
    assert g["marketable_yield_percent"] == round(225 / 300 * 100, 2)

    overview = client.get("/api/analytics/overview", headers=auth(users["admin"])).json()
    assert overview["grading"]["grade_kg"] == {"A": 140.0, "B": 60.0, "C": 25.0, "D": 75.0}
    assert overview["kpis"]["current"]["marketable_yield_percent"] == 75.0
    assert overview["yield_trend"][-1]["marketable_kg"] == 225.0


# ── 17: traceability ─────────────────────────────────────────────────────────

def test_grading_events_record_before_and_after(client, users):
    set_policy(client, users["admin"], ["A", "B", "C"])
    h = create(client, users["hazriq"]).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]),
                 json={"grades": {"A": 90, "B": 60, "C": 25, "D": 25}})

    events = client.get(f"/api/harvest/{h['id']}/events", headers=auth(users["admin"])).json()["items"]
    types = [e["event_type"] for e in events]
    assert types.count("grading_recorded") == 1
    assert types.count("grading_updated") == 1
    # The derived grade label does not produce a separate event
    assert "quality_updated" not in types

    updated = next(e for e in events if e["event_type"] == "grading_updated")
    assert updated["actor_name"] == "Admin"
    assert updated["metadata"]["previous_grades"]["A"] == 100.0
    assert updated["metadata"]["new_grades"]["D"] == 25.0
    assert updated["metadata"]["previous_marketable_kg"] == 185.0
    assert updated["metadata"]["new_marketable_kg"] == 175.0
    assert "A 100 kg to 90 kg" in updated["description"]

    # Saving the same quantities again adds nothing
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]),
                 json={"grades": {"A": 90, "B": 60, "C": 25, "D": 25}})
    again = client.get(f"/api/harvest/{h['id']}/events", headers=auth(users["admin"])).json()
    assert again["total"] == len(events)


def test_deleting_a_batch_removes_its_grades(client, users, db_session):
    h = create(client, users["hazriq"]).json()
    assert client.delete(f"/api/harvest/{h['id']}", headers=auth(users["admin"])).status_code == 204
    db_session.expire_all()
    assert db_session.query(HarvestGrade).count() == 0


# ── Non-marketable kg sorted out at harvest ──────────────────────────────────

def test_non_marketable_counts_in_total_and_is_logged_as_waste(client, users, db_session):
    res = create(client, users["hazriq"], kg=220, grades=EXAMPLE, non_marketable_kg=20, non_marketable_reason="rotten")
    assert res.status_code == 201, res.text
    h = res.json()
    # 100 + 60 + 25 + 15 graded + 20 non-marketable = 220 harvested
    assert h["quantity_kg"] == 220.0
    assert h["rejected_kg"] == 20.0
    assert h["rejected_at_sorting_kg"] == 20.0
    assert h["rejected_after_grading_kg"] == 0.0
    assert h["marketable_yield_kg"] == 200.0
    assert h["marketable_yield_percent"] == round(200 / 220 * 100, 2)

    waste = db_session.query(Waste).filter(Waste.harvest_id == h["id"]).all()
    assert len(waste) == 1
    assert waste[0].quantity_kg == 20.0 and waste[0].waste_type == "rotten"
    assert waste[0].user_id == users["hazriq"].id

    # The waste record classifies the rejection; nothing is subtracted twice
    q = details(client, users["admin"], h["id"])["quantities"]
    assert q["marketable_kg"] == 200.0
    assert q["rejected_at_sorting_kg"] == 20.0
    assert q["waste_recorded_kg"] == 20.0
    assert q["unclassified_losses_kg"] == 0.0
    assert q["waste_exceeds_losses_kg"] == 0.0

    events = client.get(f"/api/harvest/{h['id']}/events", headers=auth(users["hazriq"])).json()["items"]
    types = [e["event_type"] for e in events]
    assert "waste_recorded" in types
    graded = next(e for e in events if e["event_type"] == "grading_recorded")
    assert "Non-marketable at sorting: 20 kg" in graded["description"]


def test_non_marketable_must_reconcile_with_total(client, users):
    res = create(client, users["hazriq"], kg=200, grades=EXAMPLE, non_marketable_kg=20)
    assert res.status_code == 400
    assert "Grade and non-marketable quantities add up to 220 kg" in res.json()["detail"]
    assert create(client, users["hazriq"], kg=200, grades=None, non_marketable_kg=20).status_code == 400
    assert create(client, users["hazriq"], kg=220, grades=EXAMPLE, non_marketable_kg=20,
                  non_marketable_reason="stolen").status_code == 400


def test_whole_batch_non_marketable(client, users):
    h = create(client, users["hazriq"], kg=30, grades={}, non_marketable_kg=30).json()
    assert h["marketable_yield_kg"] == 0.0
    assert h["quality_grade"] == "ungraded"
    assert h["grading_basis"] == "grade_based"


def test_rejection_after_grading_adds_to_sorting_rejection(client, users):
    h = create(client, users["hazriq"], kg=220, grades=EXAMPLE, non_marketable_kg=20).json()
    # Total rejection 30 = 20 at sorting + 10 rejected later from the graded stock
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 30})
    assert res.status_code == 200, res.text
    assert res.json()["rejected_after_grading_kg"] == 10.0
    assert res.json()["marketable_yield_kg"] == 190.0

    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 10})
    assert res.status_code == 400
    assert "cannot be less than the 20 kg" in res.json()["detail"]


def test_regrading_moves_kg_into_non_marketable_and_logs_the_increase(client, users, db_session):
    h = create(client, users["hazriq"], kg=220, grades=EXAMPLE, non_marketable_kg=20).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 25})  # 5 after grading
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]), json={
        "grades": {"A": 100, "B": 60, "C": 25, "D": 5}, "non_marketable_kg": 30, "non_marketable_reason": "damaged",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["rejected_at_sorting_kg"] == 30.0
    assert body["rejected_after_grading_kg"] == 5.0  # kept
    assert body["marketable_yield_kg"] == 185.0      # 190 graded - 5 rejected later

    waste = sorted(w.quantity_kg for w in db_session.query(Waste).filter(Waste.harvest_id == h["id"]))
    assert waste == [10.0, 20.0]  # only the extra 10 kg is logged

    events = client.get(f"/api/harvest/{h['id']}/events", headers=auth(users["admin"])).json()["items"]
    updated = next(e for e in events if e["event_type"] == "grading_updated")
    assert "non-marketable 20 kg to 30 kg" in updated["description"]


def test_ungraded_batch_rejection_merges_with_sorting_figure(client, users):
    h = create(client, users["hazriq"], kg=100, grades=None).json()
    client.patch(f"/api/harvest/{h['id']}", headers=auth(users["admin"]), json={"rejected_kg": 8})
    res = client.patch(f"/api/harvest/{h['id']}", headers=auth(users["hazriq"]),
                       json={"grades": {"A": 90}, "non_marketable_kg": 10})
    body = res.json()
    # The 8 kg rejected before grading is part of the 10 kg sorted out, not extra
    assert body["rejected_kg"] == 10.0
    assert body["marketable_yield_kg"] == 90.0
