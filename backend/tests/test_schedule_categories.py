"""
Post-harvest task categories: new values are accepted and historical ones keep working
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.config import Base, engine, SessionLocal, get_db, is_sqlite
from app.main import app
from app.models import Schedule, User
from app.services.auth_service import create_access_token


@pytest.fixture
def setup():
    assert is_sqlite, "Tests must run against the throwaway SQLite database set up in conftest.py"
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    admin = User(username="admin", email="a@t.com", password_hash="x", full_name="Admin", role="admin")
    worker = User(username="w1", email="w1@t.com", password_hash="x", full_name="W One", role="worker")
    db.add_all([admin, worker])
    db.commit()

    def override():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    yield TestClient(app), db, admin, worker
    if previous:
        app.dependency_overrides[get_db] = previous
    else:
        app.dependency_overrides.pop(get_db, None)
    db.close()
    Base.metadata.drop_all(bind=engine)


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


@pytest.mark.parametrize("task_type", [
    "inspection", "sorting_grading", "packaging", "transport_preparation", "transport", "waste_handling",
])
def test_post_harvest_categories_accepted(setup, task_type):
    client, _, admin, worker = setup
    res = client.post("/api/schedule", headers=auth(admin), json={
        "task_type": task_type, "assigned_date": str(date.today()), "worker_id": worker.id,
    })
    assert res.status_code == 201, res.text
    assert res.json()["task_type"] == task_type


def test_unknown_category_rejected(setup):
    client, _, admin, worker = setup
    res = client.post("/api/schedule", headers=auth(admin), json={
        "task_type": "irrigation", "assigned_date": str(date.today()), "worker_id": worker.id,
    })
    assert res.status_code == 400


def test_historical_maintenance_task_still_loads_and_edits(setup):
    client, db, admin, worker = setup
    old = Schedule(worker_id=worker.id, task_type="maintenance", assigned_date=date(2025, 1, 5), status="completed")
    db.add(old)
    db.commit()

    items = client.get("/api/schedule", headers=auth(admin)).json()["items"]
    assert [s["task_type"] for s in items] == ["maintenance"]

    res = client.put(f"/api/schedule/{old.id}", headers=auth(admin), json={"task_type": "maintenance", "priority": "high"})
    assert res.status_code == 200, res.text


def test_worker_can_complete_own_task_directly_but_not_others(setup):
    client, db, admin, worker = setup
    other = User(username="w2", email="w2@t.com", password_hash="x", role="worker")
    db.add(other)
    db.commit()
    task = client.post("/api/schedule", headers=auth(admin), json={
        "task_type": "packaging", "assigned_date": str(date.today()), "worker_id": worker.id,
    }).json()

    assert client.patch(f"/api/schedule/{task['id']}/status", headers=auth(other),
                        params={"new_status": "completed"}).status_code == 403
    res = client.patch(f"/api/schedule/{task['id']}/status", headers=auth(worker), params={"new_status": "completed"})
    assert res.status_code == 200 and res.json()["status"] == "completed"
    # Workers cannot edit task fields
    assert client.put(f"/api/schedule/{task['id']}", headers=auth(worker), json={"details": "x"}).status_code == 403
