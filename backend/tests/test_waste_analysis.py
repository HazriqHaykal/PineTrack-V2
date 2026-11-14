"""
PineTrack Agent waste analysis: Gemini answers, validation, rule fallback,
value calculation, staleness and permissions
"""

import json as json_lib
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Base, engine, SessionLocal, get_db, is_sqlite, settings
from app.main import app
from app.models import Harvest, User, Waste
from app.services import gemini_service
from app.services.auth_service import create_access_token


@pytest.fixture
def env():
    assert is_sqlite, "Tests must run against the throwaway SQLite database set up in conftest.py"
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    admin = User(username="admin", email="a@t.com", password_hash="x", role="admin")
    w1 = User(username="w1", email="w1@t.com", password_hash="x", role="worker")
    w2 = User(username="w2", email="w2@t.com", password_hash="x", role="worker")
    db.add_all([admin, w1, w2])
    db.commit()
    batch = Harvest(user_id=admin.id, batch_number="PT-W-001", field_name="Block A", harvest_date=date.today(),
                    quantity_kg=500, quality_grade="C", ripeness_level=9, harvest_status="graded",
                    spoilage_kg=40, rejected_kg=10)
    db.add(batch)
    db.commit()

    def override():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    yield {"client": TestClient(app), "db": db, "admin": admin, "w1": w1, "w2": w2, "batch": batch}
    if previous:
        app.dependency_overrides[get_db] = previous
    else:
        app.dependency_overrides.pop(get_db, None)
    db.close()
    Base.metadata.drop_all(bind=engine)


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def add_waste(db, user, **kw):
    w = Waste(user_id=user.id, waste_type=kw.get("waste_type", "overripe"), quantity_kg=kw.get("quantity_kg", 100),
              classification=kw.get("classification", "compostable"), waste_date=date.today(),
              harvest_id=kw.get("harvest_id"), notes=kw.get("notes"))
    db.add(w)
    db.commit()
    return w


def fake_gemini(monkeypatch, answer=None, status_code=200):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None, verify=None):
        calls.append(json)
        body = {"candidates": [{"content": {"parts": [{"text": json_lib.dumps(answer)}]}}]}
        return httpx.Response(status_code, json=body if status_code == 200 else {"error": "nope"})

    monkeypatch.setattr(gemini_service.httpx, "post", fake_post)
    return calls


def test_rules_fallback_without_key(env, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    c, db, admin = env["client"], env["db"], env["admin"]
    w = add_waste(db, admin, waste_type="rotten", quantity_kg=100)
    res = c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": [w.id]})
    assert res.status_code == 200, res.text
    item = res.json()["items"][0]
    assert item["source"] == "rules" and item["route"] == "compost"
    assert (item["value_low"], item["value_high"]) == (15.0, 25.0)   # 100 kg x RM 0.15-0.25
    stored = c.get("/api/ai/waste-analysis", headers=auth(admin)).json()
    assert stored["agent_available"] is False
    assert [i["waste_id"] for i in stored["items"]] == [w.id] and stored["items"][0]["stale"] is False
    assert {r["route"] for r in stored["rates"]} >= {"compost", "processing", "review"}


def test_gemini_answer_used_and_value_calculated(env, monkeypatch):
    c, db, admin, batch = env["client"], env["db"], env["admin"], env["batch"]
    w = add_waste(db, admin, waste_type="overripe", quantity_kg=50, harvest_id=batch.id, notes="soft but no mould")
    calls = fake_gemini(monkeypatch, [{
        "waste_id": w.id, "route": "processing", "action": "Sell to jam processor within 24 hours",
        "explanation": "Ripeness 9/10 and no mould noted.", "alternatives": ["Vinegar", "Enzyme"],
        "warning": "Process quickly.", "suitable_for_reuse": True, "confidence": 0.82,
        # A model-supplied value must be ignored
        "value_low": 9999,
    }])
    item = c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": [w.id]}).json()["items"][0]
    assert item["source"] == "gemini" and item["action"] == "Sell to jam processor within 24 hours"
    assert (item["value_low"], item["value_high"]) == (20.0, 40.0)   # 50 kg x RM 0.40-0.80, not 9999
    prompt = calls[0]["contents"][0]["parts"][0]["text"]
    assert "soft but no mould" in prompt and "PT-W-001" in prompt and '"quality_grade": "C"' in prompt


def test_invalid_gemini_items_fall_back_per_record(env, monkeypatch):
    c, db, admin = env["client"], env["db"], env["admin"]
    a = add_waste(db, admin, waste_type="unused_parts", classification="recyclable", quantity_kg=10)
    b = add_waste(db, admin, waste_type="damaged", classification="recyclable", quantity_kg=10)
    fake_gemini(monkeypatch, [
        {"waste_id": a.id, "route": "feed", "action": "Give to goat farm", "explanation": "x", "alternatives": [],
         "warning": "", "suitable_for_reuse": True, "confidence": 0.7},
        {"waste_id": b.id, "route": "sell_on_moon", "action": "??", "explanation": "x", "alternatives": [],
         "warning": "", "suitable_for_reuse": True, "confidence": 2},
        {"waste_id": 99999, "route": "compost", "action": "Not asked for", "explanation": "", "alternatives": [],
         "warning": "", "suitable_for_reuse": True, "confidence": 0.5},
    ])
    items = {i["waste_id"]: i for i in c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": [a.id, b.id]}).json()["items"]}
    assert set(items) == {a.id, b.id}
    assert items[a.id]["source"] == "gemini"
    assert items[b.id]["source"] == "rules" and items[b.id]["route"] == "low_grade"


def test_gemini_failure_uses_rules(env, monkeypatch):
    c, db, admin = env["client"], env["db"], env["admin"]
    w = add_waste(db, admin, classification="non-recyclable")
    fake_gemini(monkeypatch, status_code=500)
    item = c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": [w.id]}).json()["items"][0]
    assert item["source"] == "rules" and item["route"] == "dispose" and item["value_high"] == 0


def test_edit_marks_analysis_stale_but_disposal_change_does_not(env, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    c, db, admin = env["client"], env["db"], env["admin"]
    w = add_waste(db, admin, waste_type="other", quantity_kg=5)
    item = c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": [w.id]}).json()["items"][0]
    assert item["route"] == "review" and item["value_low"] is None

    # Applying the recommendation as the disposal method keeps the analysis current
    c.put(f"/api/waste/{w.id}", headers=auth(admin), json={"disposal_method": "Manual review"})
    assert c.get("/api/ai/waste-analysis", headers=auth(admin)).json()["items"][0]["stale"] is False
    # Changing the facts makes it outdated
    c.put(f"/api/waste/{w.id}", headers=auth(admin), json={"quantity_kg": 6})
    latest = c.get("/api/ai/waste-analysis", headers=auth(admin)).json()["items"][0]
    assert latest["stale"] is True and latest["value_low"] is None


def test_worker_permissions(env, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    c, db, w1, w2 = env["client"], env["db"], env["w1"], env["w2"]
    mine = add_waste(db, w1)
    theirs = add_waste(db, w2)
    assert c.post("/api/ai/waste-analysis", headers=auth(w1), json={"waste_ids": [theirs.id]}).status_code == 404
    assert c.post("/api/ai/waste-analysis", headers=auth(w1), json={"waste_ids": [mine.id]}).status_code == 200
    c.post("/api/ai/waste-analysis", headers=auth(w2), json={"waste_ids": [theirs.id]})
    assert [i["waste_id"] for i in c.get("/api/ai/waste-analysis", headers=auth(w1)).json()["items"]] == [mine.id]


def test_request_size_limits(env):
    c, admin = env["client"], env["admin"]
    assert c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": []}).status_code == 422
    assert c.post("/api/ai/waste-analysis", headers=auth(admin), json={"waste_ids": list(range(1, 27))}).status_code == 422
