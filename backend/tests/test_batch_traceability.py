"""
Tests for batch lifecycle, quantity reconciliation and the traceability timeline
"""

import threading
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Base, engine, SessionLocal, get_db, is_sqlite
from app.main import app
from app.models import BatchEvent, Harvest, Transport, User
from app.schemas import HarvestCreate, TransportCreate
from app.services.auth_service import create_access_token
from app.services.batch_service import BatchService
from app.services.harvest_service import HarvestService
from app.services.transport_service import TransportService


@pytest.fixture
def db_session():
    # These tests drop every table afterwards; never let them near a real database
    assert is_sqlite, "Tests must run against the throwaway SQLite database set up in conftest.py"
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """API client on the test database (another test module overrides get_db globally)"""
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


def make_batch(client, user, kg=200.0, spoilage=0, rejected=0, status="graded"):
    """Create a batch through the API, then grade it"""
    res = client.post("/api/harvest", headers=auth(user), json={
        "field_name": "Block A-1", "harvest_date": str(date.today()), "quantity_kg": kg, "quality_grade": "B",
    })
    assert res.status_code == 201, res.text
    batch = res.json()
    res = client.patch(f"/api/harvest/{batch['id']}", headers=auth(user), json={
        "spoilage_kg": spoilage, "rejected_kg": rejected, "harvest_status": status,
    })
    assert res.status_code == 200, res.text
    return res.json()


def allocate(client, user, batch_id, kg, status="pending"):
    return client.post("/api/transport", headers=auth(user), json={
        "destination": "Kuala Lumpur Central Market", "vehicle_number": "WXY 1234", "driver_name": "Driver",
        "scheduled_date": str(date.today() + timedelta(days=1)), "cargo_weight_kg": kg,
        "harvest_id": batch_id, "status": status,
    })


def quantities(client, user, batch_id):
    res = client.get(f"/api/harvest/{batch_id}/reconciliation", headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()


def events(client, user, batch_id, **params):
    res = client.get(f"/api/harvest/{batch_id}/events", headers=auth(user), params=params)
    assert res.status_code == 200, res.text
    return res.json()


class TestTimelineEvents:
    def test_creating_a_batch_records_an_event(self, client, users):
        res = client.post("/api/harvest", headers=auth(users["hazriq"]), json={
            "field_name": "Block A-1", "harvest_date": str(date.today()), "quantity_kg": 180,
        })
        batch = res.json()

        timeline = events(client, users["hazriq"], batch["id"])
        assert timeline["history_complete"] is True
        assert [e["event_type"] for e in timeline["items"]] == ["harvest_created"]
        event = timeline["items"][0]
        assert batch["batch_number"] in event["description"]
        assert "180 kg" in event["description"]
        assert event["actor_name"] == "Hazriq"
        assert event["related_module"] == "harvest"
        assert event["metadata"]["quantity_kg"] == 180

    def test_grade_update_records_what_changed(self, client, users):
        batch = make_batch(client, users["admin"])
        client.patch(f"/api/harvest/{batch['id']}", headers=auth(users["admin"]),
                     json={"quality_grade": "A", "ripeness_level": 8})

        quality = events(client, users["admin"], batch["id"], event_type="quality_updated")["items"]
        assert len(quality) == 1
        assert quality[0]["description"] == "Grade A assigned. Ripeness level: 8/10."
        assert quality[0]["metadata"]["changes"]["quality_grade"] == {"from": "B", "to": "A"}

    def test_repeating_an_update_adds_no_duplicate_event(self, client, users):
        batch = make_batch(client, users["admin"])
        for _ in range(2):
            client.patch(f"/api/harvest/{batch['id']}", headers=auth(users["admin"]), json={"harvest_status": "processed"})

        assert events(client, users["admin"], batch["id"], event_type="status_changed")["total"] == 2  # graded, then processed

    def test_transport_lifecycle_is_traced(self, client, users):
        batch = make_batch(client, users["admin"], kg=180)
        transport = allocate(client, users["admin"], batch["id"], 150).json()
        for status in ("in_transit", "delivered"):
            client.patch(f"/api/transport/{transport['id']}/status", headers=auth(users["admin"]),
                         params={"new_status": status})

        types = [e["event_type"] for e in events(client, users["admin"], batch["id"])["items"]]
        assert types[:3] == ["transport_delivered", "transport_dispatched", "transport_allocated"]
        delivered = events(client, users["admin"], batch["id"], event_type="transport_delivered")["items"][0]
        assert delivered["description"] == "150 kg confirmed delivered to Kuala Lumpur Central Market."
        assert delivered["related_record_id"] == transport["id"]

    def test_waste_changes_are_traced(self, client, users):
        batch = make_batch(client, users["admin"], spoilage=5)
        waste = client.post("/api/waste", headers=auth(users["admin"]), json={
            "waste_type": "rotten", "quantity_kg": 5, "harvest_id": batch["id"],
        }).json()
        client.delete(f"/api/waste/{waste['id']}", headers=auth(users["admin"]))

        types = [e["event_type"] for e in events(client, users["admin"], batch["id"])["items"]]
        assert types[:2] == ["waste_removed", "waste_recorded"]

    def test_failed_request_records_no_event(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        assert allocate(client, users["admin"], batch["id"], 150).status_code == 400

        assert events(client, users["admin"], batch["id"], event_type="transport_allocated")["total"] == 0

    def test_historical_batch_without_events_is_still_viewable(self, client, users, db_session):
        # Inserted directly, the way records existed before event logging
        harvest = Harvest(user_id=users["hazriq"].id, batch_number="PT-2025-001", field_name="Old Block",
                          harvest_date=date.today() - timedelta(days=300), quantity_kg=90,
                          quality_grade="A", harvest_status="processed", spoilage_kg=0, rejected_kg=0)
        db_session.add(harvest)
        db_session.commit()

        details = client.get(f"/api/harvest/{harvest.id}/details", headers=auth(users["hazriq"]))
        assert details.status_code == 200
        assert details.json()["history_complete"] is False
        assert details.json()["history_note"]
        assert details.json()["quantities"]["available_kg"] == 90
        timeline = events(client, users["hazriq"], harvest.id)
        assert timeline["items"] == []
        assert timeline["history_complete"] is False


class TestQuantityReconciliation:
    def test_allocation_reduces_available_quantity(self, client, users):
        batch = make_batch(client, users["admin"], kg=200, spoilage=5, rejected=5)
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 190

        assert allocate(client, users["admin"], batch["id"], 100).status_code == 201
        q = quantities(client, users["admin"], batch["id"])
        assert q["marketable_kg"] == 190
        assert q["reserved_kg"] == 100
        assert q["available_kg"] == 90

    def test_allocations_cannot_exceed_marketable_quantity(self, client, users):
        # The worked example: 200 harvested, 5 spoiled, 5 rejected, 100 reserved, 40 delivered
        batch = make_batch(client, users["admin"], kg=200, spoilage=5, rejected=5)
        allocate(client, users["admin"], batch["id"], 100)
        allocate(client, users["admin"], batch["id"], 40, status="delivered")
        q = quantities(client, users["admin"], batch["id"])
        assert (q["reserved_kg"], q["delivered_kg"], q["available_kg"]) == (100, 40, 50)

        res = allocate(client, users["admin"], batch["id"], 60)
        assert res.status_code == 400
        assert "Only 50 kg" in res.json()["detail"]
        assert "cannot allocate 60 kg" in res.json()["detail"]

        assert allocate(client, users["admin"], batch["id"], 50).status_code == 201
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 0

    def test_decimal_quantities_do_not_drift(self, client, users):
        batch = make_batch(client, users["admin"], kg=0.3)
        assert allocate(client, users["admin"], batch["id"], 0.1).status_code == 201
        assert allocate(client, users["admin"], batch["id"], 0.2).status_code == 201  # 0.1 + 0.2 is not 0.3 in floats
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 0

    def test_cancelling_an_undelivered_allocation_restores_availability(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        transport = allocate(client, users["admin"], batch["id"], 80).json()
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 20

        client.patch(f"/api/transport/{transport['id']}/status", headers=auth(users["admin"]),
                     params={"new_status": "cancelled"})
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 100

        # Reactivating it must fit the stock again
        allocate(client, users["admin"], batch["id"], 50)
        res = client.patch(f"/api/transport/{transport['id']}/status", headers=auth(users["admin"]),
                           params={"new_status": "pending"})
        assert res.status_code == 400
        assert "Only 50 kg" in res.json()["detail"]

    def test_delivered_quantities_remain_accounted_for(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        transport = allocate(client, users["admin"], batch["id"], 60, status="delivered").json()
        headers = auth(users["admin"])

        cancel = client.patch(f"/api/transport/{transport['id']}/status", headers=headers, params={"new_status": "cancelled"})
        assert cancel.status_code == 400
        reweigh = client.put(f"/api/transport/{transport['id']}", headers=headers, json={"cargo_weight_kg": 10})
        assert reweigh.status_code == 400
        assert client.delete(f"/api/transport/{transport['id']}", headers=headers).status_code == 409

        q = quantities(client, users["admin"], batch["id"])
        assert (q["delivered_kg"], q["dispatched_kg"], q["available_kg"]) == (60, 60, 40)

    def test_updating_an_allocation_excludes_its_previous_quantity(self, client, users):
        batch = make_batch(client, users["admin"], kg=200, spoilage=5, rejected=5)
        transport = allocate(client, users["admin"], batch["id"], 100).json()
        headers = auth(users["admin"])

        # 190 fits because the transport's own 100 kg is released first
        assert client.put(f"/api/transport/{transport['id']}", headers=headers, json={"cargo_weight_kg": 190}).status_code == 200
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 0
        res = client.put(f"/api/transport/{transport['id']}", headers=headers, json={"cargo_weight_kg": 191})
        assert res.status_code == 400
        assert "Only 190 kg" in res.json()["detail"]

        assert client.put(f"/api/transport/{transport['id']}", headers=headers, json={"cargo_weight_kg": 120}).status_code == 200
        assert quantities(client, users["admin"], batch["id"])["available_kg"] == 70

    def test_moving_an_allocation_to_another_batch(self, client, users):
        first = make_batch(client, users["admin"], kg=100)
        second = make_batch(client, users["admin"], kg=50)
        transport = allocate(client, users["admin"], first["id"], 80).json()

        res = client.put(f"/api/transport/{transport['id']}", headers=auth(users["admin"]), json={"harvest_id": second["id"]})
        assert res.status_code == 400  # 80 kg does not fit in 50 kg

        client.put(f"/api/transport/{transport['id']}", headers=auth(users["admin"]),
                   json={"harvest_id": second["id"], "cargo_weight_kg": 50})
        assert quantities(client, users["admin"], first["id"])["available_kg"] == 100
        assert quantities(client, users["admin"], second["id"])["available_kg"] == 0
        assert events(client, users["admin"], first["id"], event_type="transport_unlinked")["total"] == 1

    def test_linked_transport_requires_cargo_weight(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        res = allocate(client, users["admin"], batch["id"], None)
        assert res.status_code == 400
        assert "Cargo weight is required" in res.json()["detail"]

    def test_rejected_batch_cannot_be_allocated(self, client, users):
        batch = make_batch(client, users["admin"], kg=100, status="rejected")
        res = allocate(client, users["admin"], batch["id"], 10)
        assert res.status_code == 400
        assert "rejected" in res.json()["detail"]

    def test_harvest_changes_that_break_commitments_are_rejected(self, client, users):
        batch = make_batch(client, users["admin"], kg=200, spoilage=5, rejected=5)
        allocate(client, users["admin"], batch["id"], 190)
        headers = auth(users["admin"])

        res = client.patch(f"/api/harvest/{batch['id']}", headers=headers, json={"spoilage_kg": 20})
        assert res.status_code == 400
        assert "190 kg committed" in res.json()["detail"]

        res = client.patch(f"/api/harvest/{batch['id']}", headers=headers, json={"harvest_status": "rejected"})
        assert res.status_code == 400
        assert "Cancel or complete them" in res.json()["detail"]

        # Lowering losses is always allowed
        assert client.patch(f"/api/harvest/{batch['id']}", headers=headers, json={"spoilage_kg": 0}).status_code == 200
        assert quantities(client, users["admin"], batch["id"])["spoilage_kg"] == 0

    def test_waste_records_are_not_double_counted(self, client, users):
        batch = make_batch(client, users["admin"], kg=200, spoilage=12, rejected=15)
        before = quantities(client, users["admin"], batch["id"])
        for kind, kg in (("rotten", 12), ("unused_parts", 15)):
            client.post("/api/waste", headers=auth(users["admin"]),
                        json={"waste_type": kind, "quantity_kg": kg, "harvest_id": batch["id"]})

        after = quantities(client, users["admin"], batch["id"])
        assert after["available_kg"] == before["available_kg"] == 173
        assert after["waste_recorded_kg"] == 27
        assert after["recorded_losses_kg"] == 27
        assert after["unclassified_losses_kg"] == 0
        assert after["waste_exceeds_losses_kg"] == 0

    def test_batch_with_linked_records_cannot_be_deleted(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        allocate(client, users["admin"], batch["id"], 10)

        res = client.delete(f"/api/harvest/{batch['id']}", headers=auth(users["admin"]))
        assert res.status_code == 409
        assert "linked" in res.json()["detail"]

    def test_unlinked_batch_deletes_with_its_events(self, client, users, db_session):
        batch = make_batch(client, users["admin"], kg=100)
        assert client.delete(f"/api/harvest/{batch['id']}", headers=auth(users["admin"])).status_code == 204
        assert db_session.query(BatchEvent).filter(BatchEvent.batch_id == batch["id"]).count() == 0


class TestLifecycle:
    def test_lifecycle_follows_the_records(self, client, users):
        headers = auth(users["admin"])

        def lifecycle(batch_id):
            return client.get(f"/api/harvest/{batch_id}/lifecycle", headers=headers).json()["code"]

        batch = make_batch(client, users["admin"], kg=100, status="pending")
        assert lifecycle(batch["id"]) == "awaiting_inspection"

        client.patch(f"/api/harvest/{batch['id']}", headers=headers, json={"harvest_status": "graded"})
        assert lifecycle(batch["id"]) == "ready_for_dispatch"

        first = allocate(client, users["admin"], batch["id"], 60).json()
        assert lifecycle(batch["id"]) == "partially_allocated"

        second = allocate(client, users["admin"], batch["id"], 40).json()
        assert lifecycle(batch["id"]) == "fully_allocated"

        client.patch(f"/api/transport/{first['id']}/status", headers=headers, params={"new_status": "in_transit"})
        assert lifecycle(batch["id"]) == "in_transit"

        client.patch(f"/api/transport/{first['id']}/status", headers=headers, params={"new_status": "delivered"})
        assert lifecycle(batch["id"]) == "partially_delivered"

        client.patch(f"/api/transport/{second['id']}/status", headers=headers, params={"new_status": "delivered"})
        assert lifecycle(batch["id"]) == "delivered"

    def test_rejected_batch_is_closed(self, client, users):
        batch = make_batch(client, users["admin"], kg=100, status="rejected")
        res = client.get(f"/api/harvest/{batch['id']}/lifecycle", headers=auth(users["admin"]))
        assert res.json()["label"] == "Closed / Rejected"

    def test_cancelled_transports_are_ignored(self, client, users):
        batch = make_batch(client, users["admin"], kg=100)
        transport = allocate(client, users["admin"], batch["id"], 100).json()
        client.patch(f"/api/transport/{transport['id']}/status", headers=auth(users["admin"]),
                     params={"new_status": "cancelled"})

        overview = client.get("/api/harvest/lifecycle/overview", headers=auth(users["admin"])).json()["items"]
        row = next(i for i in overview if i["harvest_id"] == batch["id"])
        assert row["lifecycle_status"] == "ready_for_dispatch"
        assert row["available_kg"] == 100


class TestAuthorization:
    def test_workers_cannot_open_other_workers_batches(self, client, users):
        batch = make_batch(client, users["hazriq"], kg=100)

        for path in ("details", "events", "lifecycle", "reconciliation", "transports", "waste"):
            url = f"/api/harvest/{batch['id']}/{path}"
            assert client.get(url, headers=auth(users["arif"])).status_code == 403, path
            assert client.get(url, headers=auth(users["hazriq"])).status_code == 200, path
            assert client.get(url, headers=auth(users["admin"])).status_code == 200, path

        assert client.get("/api/harvest/999/details", headers=auth(users["admin"])).status_code == 404

    def test_overview_only_lists_the_workers_own_batches(self, client, users):
        own = make_batch(client, users["hazriq"], kg=100)
        make_batch(client, users["arif"], kg=100)

        overview = client.get("/api/harvest/lifecycle/overview", headers=auth(users["hazriq"])).json()["items"]
        assert [i["harvest_id"] for i in overview] == [own["id"]]

    def test_workers_do_not_see_records_or_names_of_others(self, client, users):
        batch = make_batch(client, users["hazriq"], kg=100)
        # Arif logs waste against nothing; the admin allocates a transport on Hazriq's batch
        allocate(client, users["admin"], batch["id"], 30)

        details = client.get(f"/api/harvest/{batch['id']}/details", headers=auth(users["hazriq"])).json()
        assert details["transports"]["items"] == []
        assert details["transports"]["hidden_count"] == 1
        assert details["quantities"]["reserved_kg"] == 30  # totals still include every record

        allocated = events(client, users["hazriq"], batch["id"], event_type="transport_allocated")["items"][0]
        assert allocated["actor_name"] == "Admin"
        assert allocated["actor_user_id"] is None


class TestConcurrency:
    def test_simultaneous_allocations_cannot_over_allocate(self, db_session, users):
        batch = HarvestService.create_harvest(
            db_session,
            HarvestCreate(field_name="Block A-1", harvest_date=date.today(), quantity_kg=100),
            users["admin"].id,
        )
        batch_id, admin_id = batch.id, users["admin"].id

        barrier = threading.Barrier(4)
        results = []

        def attempt():
            session = SessionLocal()
            try:
                barrier.wait()
                TransportService.create_transport(session, TransportCreate(
                    destination="Market", scheduled_date=date.today(), cargo_weight_kg=60, harvest_id=batch_id,
                ), admin_id)
                results.append("ok")
            except ValueError:
                session.rollback()
                results.append("refused")
            finally:
                session.close()

        threads = [threading.Thread(target=attempt) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(results) == ["ok", "refused", "refused", "refused"]
        db_session.expire_all()
        reserved = db_session.query(Transport).filter(Transport.harvest_id == batch_id).count()
        assert reserved == 1
        assert BatchService.reconciliation(db_session, db_session.get(Harvest, batch_id))["available_kg"] == 40


class TestRejectedBatchQuantities:
    def test_rejected_batch_stock_is_withheld_not_available(self, client, users):
        batch = make_batch(client, users["admin"], kg=60, spoilage=12, rejected=15, status="rejected")
        q = quantities(client, users["admin"], batch["id"])
        assert (q["marketable_kg"], q["available_kg"], q["withheld_kg"]) == (33, 0, 33)

        overview = client.get("/api/harvest/lifecycle/overview", headers=auth(users["admin"])).json()["items"]
        assert next(i for i in overview if i["harvest_id"] == batch["id"])["available_kg"] == 0
