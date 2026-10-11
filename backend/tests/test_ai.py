"""
Tests for the AI service: Gemini answers and the rule-based fallback
"""

import json as json_lib
import pytest
import httpx
from datetime import date, timedelta
from app.config import Base, engine, SessionLocal, settings
from app.models import Harvest, Transport, User
from app.services import gemini_service
from app.services.ai_service import AIService, RULES_MODEL
from app.services.gemini_service import GeminiService, GeminiError


@pytest.fixture
def db_session():
    """Create a test database session"""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def harvest(db_session):
    user = User(username="aiworker", email="ai@test.com", password_hash="x", role="worker")
    db_session.add(user)
    db_session.commit()
    record = Harvest(
        user_id=user.id, batch_number="PT-TEST-001", field_name="Block A",
        harvest_date=date.today(), quantity_kg=100, quality_grade="A",
        harvest_status="graded", spoilage_kg=20, rejected_kg=0,
    )
    db_session.add(record)
    db_session.commit()
    return record


def fake_gemini(monkeypatch, answer=None, status_code=200):
    """Make Gemini 'configured' and return a canned answer instead of calling the network"""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None, verify=None):
        calls.append({"url": url, "headers": headers, "json": json})
        body = {"candidates": [{"content": {"parts": [{"text": json_lib.dumps(answer)}]}}]}
        return httpx.Response(status_code, json=body if status_code == 200 else {"error": "nope"})

    monkeypatch.setattr(gemini_service.httpx, "post", fake_post)
    return calls


class TestWithoutGemini:
    """No API key: every prediction comes from the built-in rules"""

    def test_status_reports_rules(self, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        assert AIService.get_status() == {"provider": "rules", "model": RULES_MODEL, "gemini_configured": False}

    def test_generate_json_requires_key(self, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        with pytest.raises(GeminiError):
            GeminiService.generate_json("hi", {"type": "OBJECT"})

    def test_harvest_timing_rules(self, db_session, harvest, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        result = AIService.predict_harvest_timing(db_session, harvest.id, 8, 30, 8)

        assert result["recommendation"] == "Harvest Now"
        assert result["source"] == "rules"
        assert result["reasoning"]["total_score"] == 100
        assert result["explanation"]

    def test_waste_classification_rules(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        result = AIService.predict_waste_classification(db_session, "A", 1, 20)

        assert result["waste_type"] == "rotten"
        assert result["disposal_method"] == "compost"
        assert result["source"] == "rules"

    def test_recommendations_flag_real_problems(self, db_session, harvest, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        db_session.add(Transport(
            user_id=harvest.user_id, destination="KL Market", scheduled_date=date.today() - timedelta(days=2),
            status="pending",
        ))
        db_session.commit()

        result = AIService.get_recommendations(db_session, harvest.user_id)
        titles = [item["title"] for item in result["items"]]

        assert result["source"] == "rules"
        # 20% spoilage against a 5% target, and one overdue delivery
        assert "Spoilage rate is above target" in titles
        assert any("overdue" in t for t in titles)

    def test_recommendations_are_cached_until_refresh(self, db_session, harvest, monkeypatch):
        monkeypatch.setattr(settings, "gemini_api_key", "")
        first = AIService.get_recommendations(db_session, harvest.user_id)
        second = AIService.get_recommendations(db_session, harvest.user_id)
        assert AIService.list_ai_logs(db_session, "recommendations")[1] == 1
        assert first["generated_at"] == second["generated_at"]

        AIService.get_recommendations(db_session, harvest.user_id, refresh=True)
        assert AIService.list_ai_logs(db_session, "recommendations")[1] == 2


class TestWithGemini:
    """API key set: Gemini's answer is used, with rules as the safety net"""

    def test_harvest_timing_uses_gemini(self, db_session, harvest, monkeypatch):
        calls = fake_gemini(monkeypatch, {
            "recommendation": "Wait 5+ Days", "quality_prediction": "Low",
            "transport_priority": "Normal", "confidence_score": 0.66,
            "explanation": "Fruit is not ready.",
        })
        result = AIService.predict_harvest_timing(db_session, harvest.id, 8, 30, 8)

        assert result["source"] == "gemini"
        assert result["recommendation"] == "Wait 5+ Days"
        assert result["confidence_score"] == 0.66
        assert result["explanation"] == "Fruit is not ready."
        assert result["model_version"] == f"gemini:{settings.gemini_model}"
        # The key goes in a header, never in the URL, and the batch details are in the prompt
        assert calls[0]["headers"] == {"x-goog-api-key": "test-key"}
        assert "test-key" not in calls[0]["url"]
        assert "Block A" in calls[0]["json"]["contents"][0]["parts"][0]["text"]

    def test_gemini_error_falls_back_to_rules(self, db_session, harvest, monkeypatch):
        fake_gemini(monkeypatch, status_code=429)
        result = AIService.predict_harvest_timing(db_session, harvest.id, 8, 30, 8)

        assert result["source"] == "rules"
        assert result["recommendation"] == "Harvest Now"

    def test_invalid_gemini_values_fall_back_to_rules(self, db_session, monkeypatch):
        fake_gemini(monkeypatch, {
            "waste_type": "radioactive", "disposal_method": "compost",
            "confidence_score": 0.9, "explanation": "?",
        })
        result = AIService.predict_waste_classification(db_session, "A", 1, 20)

        assert result["source"] == "rules"
        assert result["waste_type"] == "rotten"

    def test_recommendations_use_gemini(self, db_session, harvest, monkeypatch):
        fake_gemini(monkeypatch, [{
            "type": "waste", "priority": "high", "title": "Cut spoilage in Block A",
            "description": "Spoilage is 20%.", "confidence": 140, "impact": "-15%", "action": "Inspect",
        }])
        result = AIService.get_recommendations(db_session, harvest.user_id, refresh=True)

        assert result["source"] == "gemini"
        assert result["items"][0]["title"] == "Cut spoilage in Block A"
        assert result["items"][0]["confidence"] == 100  # clamped
        assert result["items"][0]["id"] == 1
