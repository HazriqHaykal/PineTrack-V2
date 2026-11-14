"""
Module-scoped shared intelligence: PineTrack Agent recommendations and
Analytics for Sulur Inventory, Post-Harvest Management, or both.
"""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.config import Base, engine, SessionLocal, get_db, settings
from app.main import app
from app.models import AILog, Harvest, SulurBatch, SulurMovement, SulurReferenceConfig, Transport, User
from app.services.ai_service import AIService


@pytest.fixture
def db(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")  # rules only, deterministic
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def _user(db, role):
    u = User(username=role, email=f"{role}@t.com", password_hash="x", role=role)
    db.add(u)
    db.commit()
    return u


def _headers(user):
    token = jwt.encode({"sub": str(user.id), "role": user.role}, settings.secret_key, algorithm=settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin(db):
    return _user(db, "admin")


@pytest.fixture
def client(db):
    """API client on the test database (another test module overrides get_db globally)"""
    def override():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    if previous:
        app.dependency_overrides[get_db] = previous
    else:
        app.dependency_overrides.pop(get_db, None)


def _batch(db, owner, **kw):
    fields = dict(
        user_id=owner.id, batch_code=kw.pop("code", "SLR-T-001"), variety="MD2", sulur_type="sucker",
        size_grade="Grade A", initial_quantity=3000, available_quantity=3000, source_plot="Block A",
        storage_location="Shed 1", date_received=date.today(), treatment_status="ready_to_plant",
        is_certified=True,
    )
    fields.update(kw)
    b = SulurBatch(**fields)
    db.add(b)
    db.commit()
    return b


# ── Sulur module endpoints ────────────────────────────────────────────────────

def test_sulur_endpoints_work_and_do_not_insert_sample_data(db, admin, client):
    for path in ("/api/sulur/summary", "/api/sulur/batches"):
        r = client.get(path, headers=_headers(admin))
        assert r.status_code == 200, r.text
    assert db.query(SulurBatch).count() == 0
    assert db.query(SulurMovement).count() == 0
    # Variety reference values are still provided for the calculator
    assert db.query(SulurReferenceConfig).count() > 0


def test_sulur_endpoints_require_a_token(client, db):
    assert client.get("/api/sulur/summary").status_code in (401, 403)


# ── Agent scopes ──────────────────────────────────────────────────────────────

def test_sulur_scope_without_batches_invents_nothing(db, admin):
    result = AIService.get_recommendations(db, admin.id, refresh=True, scope="sulur")
    assert result["items"] == [] and result["scope"] == "sulur"
    assert result["snapshot"]["sulur"]["batches"] == 0
    assert db.query(AILog).filter(AILog.prediction_type == "recommendations_sulur").count() == 1


def test_sulur_scope_uses_module_alert_rules(db, admin):
    _batch(db, admin, available_quantity=1200)  # below MD2 default threshold (5,000)
    _batch(db, admin, code="SLR-T-002", variety="Moris", available_quantity=9000, treatment_status="curing",
           date_received=date.today() - timedelta(days=20), is_certified=False)
    result = AIService.get_recommendations(db, admin.id, refresh=True, scope="sulur")
    titles = [i["title"] for i in result["items"]]
    assert all(i["type"] == "sulur" for i in result["items"])
    assert any("MD2" in t and "below minimum" in t for t in titles)
    assert any("stored over 14 days" in t for t in titles)
    assert any("certification" in t for t in titles)
    # Post-harvest data is not part of a Sulur-only analysis
    assert "harvest" not in result["snapshot"]


def test_cached_sets_are_kept_per_scope(db, admin):
    _batch(db, admin, available_quantity=100)
    sulur = AIService.get_recommendations(db, admin.id, refresh=True, scope="sulur")
    post = AIService.get_recommendations(db, admin.id, scope="post_harvest")
    assert sulur["items"] and all(i["type"] == "sulur" for i in sulur["items"])
    assert all(i["type"] != "sulur" for i in post["items"])
    # Reading again returns each scope's own cached set
    assert AIService.get_recommendations(db, admin.id, scope="sulur")["items"] == sulur["items"]
    types = {l.prediction_type for l in db.query(AILog).all()}
    assert types == {"recommendations", "recommendations_sulur"}


def test_all_scope_keeps_modules_separate(db, admin):
    _batch(db, admin, available_quantity=100)
    db.add(Transport(user_id=admin.id, destination="KL Market", scheduled_date=date.today() - timedelta(days=2), status="pending"))
    db.add(Harvest(user_id=admin.id, batch_number="H-T-1", field_name="Field 1", harvest_date=date.today(), quantity_kg=500))
    db.commit()
    result = AIService.get_recommendations(db, admin.id, refresh=True, scope="all")
    kinds = {i["type"] for i in result["items"]}
    assert "sulur" in kinds and "transport" in kinds
    snap = result["snapshot"]
    assert snap["harvest"]["total_kg"] == 500          # kg, post-harvest section
    assert snap["sulur"]["totals"]["available"] == 100  # pieces, own section
    assert snap["sulur"]["unit"] == "sulur pieces"


def test_default_scope_is_unchanged_post_harvest(db, admin, client):
    r = client.get("/api/ai/recommendations", headers=_headers(admin))
    assert r.status_code == 200 and r.json()["scope"] == "post_harvest"
    assert db.query(AILog).one().prediction_type == "recommendations"


def test_scope_is_validated_and_admin_only(db, admin, client):
    worker = _user(db, "worker")
    assert client.get("/api/ai/recommendations?scope=everything", headers=_headers(admin)).status_code == 422
    assert client.get("/api/ai/recommendations?scope=sulur", headers=_headers(worker)).status_code == 403
    assert client.post("/api/ai/recommendations/refresh?scope=all", headers=_headers(worker)).status_code == 403


# ── Sulur analytics ───────────────────────────────────────────────────────────

def test_sulur_analytics_reports_real_records_only(db, admin, client):
    empty = client.get("/api/analytics/sulur", headers=_headers(admin)).json()
    assert empty["has_data"] is False and empty["totals"]["available"] == 0

    b = _batch(db, admin, available_quantity=2500, planted_quantity=500)
    db.add(SulurMovement(batch_id=b.id, user_id=admin.id, movement_type="plant", quantity=500, movement_date=date.today()))
    db.add(SulurMovement(batch_id=b.id, user_id=admin.id, movement_type="stock_out", quantity=40,
                         movement_date=date.today() - timedelta(days=40)))
    db.commit()

    data = client.get("/api/analytics/sulur?months=3", headers=_headers(admin)).json()
    assert data["has_data"] and data["unit"] == "sulur pieces"
    assert data["totals"]["available"] == 2500 and data["totals"]["planted"] == 500
    assert data["kpis"]["current"]["planted"] == 500
    assert data["kpis"]["previous"]["sold"] == 40
    assert len(data["movement_trend"]) == 3
    assert data["by_grade"][0]["name"] == "Grade A"


def test_sulur_analytics_admin_only(db, client):
    worker = _user(db, "worker")
    assert client.get("/api/analytics/sulur", headers=_headers(worker)).status_code == 403
