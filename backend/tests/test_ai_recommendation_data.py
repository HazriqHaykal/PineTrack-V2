"""
Farm recommendations when data is missing: no invented recommendation, other
checks still run, and the farm summary the agent saw is returned
"""

import json
from datetime import date, timedelta

import pytest

from app.config import Base, engine, SessionLocal, settings
from app.models import AILog, Schedule, Transport, User
from app.services.ai_service import AIService


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def admin(db):
    user = User(username="admin", email="a@t.com", password_hash="x", role="admin")
    db.add(user)
    db.commit()
    return user


def test_no_data_gives_no_invented_recommendation(db, admin, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    result = AIService.get_recommendations(db, admin.id, refresh=True)
    assert result["items"] == []
    assert result["snapshot"]["harvest"]["batches"] == 0
    log = db.query(AILog).filter(AILog.prediction_type == "recommendations").one()
    assert log.confidence_score is None and log.prediction_result == "0 recommendations generated"


def test_overdue_work_still_flagged_without_harvests(db, admin, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    db.add(Transport(user_id=admin.id, destination="KL Market", scheduled_date=date.today() - timedelta(days=2), status="pending"))
    db.add(Schedule(worker_id=admin.id, task_type="packaging", assigned_date=date.today() - timedelta(days=1), status="pending"))
    db.commit()

    result = AIService.get_recommendations(db, admin.id, refresh=True)
    titles = [i["title"] for i in result["items"]]
    assert any("deliver" in t for t in titles) and any("task" in t for t in titles)
    assert "No recent harvest data" not in titles
    # No harvest data means no "within targets" claim either
    assert "Operations are within targets" not in titles


def test_older_cached_logs_still_load(db, admin, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    legacy_item = {"id": 1, "type": "harvest", "priority": "low", "title": "No recent harvest data",
                   "description": "x", "confidence": 90, "impact": "", "action": "Log harvest batches"}
    db.add(AILog(user_id=admin.id, prediction_type="recommendations", prediction_result="1 recommendations generated",
                 input_data=json.dumps({"source": "rules", "items": [legacy_item], "snapshot": {"harvest": {"batches": 0}}}),
                 confidence_score=0.9, model_version="rules-v1"))
    db.commit()

    result = AIService.get_recommendations(db, admin.id)
    assert result["items"][0]["title"] == "No recent harvest data"
    assert result["snapshot"] == {"harvest": {"batches": 0}}
