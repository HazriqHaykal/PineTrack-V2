"""
Seed the database with login accounts and a small post-harvest demonstration data set.

Run from the backend folder:
    python seed.py                  # add accounts + demo data if there are no harvest batches yet
    python seed.py --postharvest    # replace only the post-harvest data (keeps accounts and Sulur data)
    python seed.py --reset          # wipe every table first, then seed

Accounts created:
    admin   / admin123    (admin)
    hazriq  / worker123   (worker)
    ibrahim / worker123   (worker)
    arif    / worker123   (worker)

The demo data is created through the same services the API uses, so every batch has a
grade breakdown (no legacy single-grade batches), a consistent traceability timeline,
sorted-out waste records and transport allocations that respect available stock.
"""

import sys
from datetime import date, datetime, time, timedelta

from app.config import Base, SessionLocal, engine
from app.models import (
    AILog, BatchEvent, Harvest, HarvestGrade, MarketabilityPolicy, QualityTarget,
    Schedule, Transport, User, Waste,
)
from app.schemas import HarvestCreate, HarvestUpdate, TransportCreate, WasteCreate
from app.services.auth_service import create_user
from app.services.harvest_service import HarvestService
from app.services.transport_service import TransportService
from app.services.waste_service import WasteService

ACCOUNTS = [
    ("admin", "admin@pinetrack.com", "admin123", "admin", "Admin"),
    ("hazriq", "hazriq@pinetrack.com", "worker123", "worker", "Hazriq"),
    ("ibrahim", "ibrahim@pinetrack.com", "worker123", "worker", "Ibrahim"),
    ("arif", "arif@pinetrack.com", "worker123", "worker", "Arif"),
]

# One entry per harvest batch, oldest first so batch numbers follow harvest order.
#   grades:      kg per grade (None = not graded yet); a single entry makes a one-grade batch
#   sorted_out:  (kg, reason) unsellable fruit removed at sorting, logged as waste automatically
#   update:      follow-up change a few days later (status, spoilage)
#   transports:  (driver, destination, vehicle, cargo kg, scheduled days ago, status, delivered days ago)
#   waste:       extra waste logged by hand: (days ago, type, kg, classification, disposal, notes)
BATCHES = [
    {
        "worker": "arif", "days_ago": 16, "field": "Block A-1", "kg": 200, "ripeness": 8,
        "grades": {"A": 120, "B": 55, "C": 15, "D": 5}, "sorted_out": (5, "damaged"),
        "notes": "Good size and colour across the block",
        "update": {"days_ago": 15, "harvest_status": "processed", "spoilage_kg": 2},
        "transports": [
            ("arif", "Seremban Distribution Centre", "NSA 3456", 180, 15, "delivered", 14),
        ],
        "waste": [
            (15, "rotten", 2, "compostable", "Compost pit", "Spoiled in storage before dispatch"),
            (15, "unused_parts", 12, "recyclable", "Animal feed", "Crowns and peel from trimming"),
        ],
    },
    {
        "worker": "ibrahim", "days_ago": 12, "field": "Block C-1", "kg": 120, "ripeness": 10,
        "grades": {"D": 90}, "sorted_out": (30, "overripe"),
        "notes": "Harvest delayed by rain, most fruit overripe",
        "update": {"days_ago": 11, "harvest_status": "rejected"},
        "transports": [],
        "waste": [
            (11, "unused_parts", 8, "recyclable", "Animal feed", "Crowns removed before disposal"),
        ],
    },
    {
        "worker": "hazriq", "days_ago": 8, "field": "Block B-2", "kg": 150, "ripeness": 7,
        "grades": {"B": 145}, "sorted_out": (5, "damaged"),
        "notes": "Uniform medium-size fruit, all Grade B",
        "update": {"days_ago": 7, "harvest_status": "processed", "spoilage_kg": 3},
        "transports": [
            ("hazriq", "Kuala Lumpur Central Market", "WXY 1234", 120, 7, "delivered", 6),
        ],
        "waste": [
            (7, "rotten", 3, "compostable", "Compost pit", "Spoilage found during packing"),
        ],
    },
    {
        "worker": "arif", "days_ago": 5, "field": "Block B-1", "kg": 160, "ripeness": 8,
        "grades": {"A": 90, "B": 45, "C": 15, "D": 6}, "sorted_out": (4, "damaged"),
        "notes": None,
        "update": {"days_ago": 4, "harvest_status": "graded"},
        "transports": [
            ("ibrahim", "Johor Bahru Fresh Produce Hub", "JHF 5678", 140, 0, "in_transit", None),
        ],
        "waste": [],
    },
    {
        "worker": "ibrahim", "days_ago": 3, "field": "Block A-2", "kg": 180, "ripeness": 9,
        "grades": {"A": 175}, "sorted_out": (5, "damaged"),
        "notes": "Premium all Grade A batch for wholesale buyer",
        "update": {"days_ago": 2, "harvest_status": "graded"},
        "transports": [
            ("hazriq", "Penang Wholesale Market", "PEX 9012", 150, -1, "pending", None),
        ],
        "waste": [],
    },
    {
        "worker": "hazriq", "days_ago": 1, "field": "Block A-3", "kg": 140, "ripeness": 7,
        "grades": None, "sorted_out": None,
        "notes": "Awaiting sorting and grading",
        "update": None,
        "transports": [],
        "waste": [],
    },
]

# (worker, days from today, task type, priority, status, details)
SCHEDULES = [
    ("arif", -5, "sorting_grading", "high", "completed", "Sort and grade Block B-1 harvest"),
    ("ibrahim", -3, "inspection", "medium", "completed", "Quality inspection - Block A-2 batch"),
    ("hazriq", 0, "sorting_grading", "high", "in_progress", "Sort and grade Block A-3 harvest"),
    ("ibrahim", 0, "transport", "high", "in_progress", "Deliver Block B-1 batch to Johor Bahru"),
    ("arif", 0, "packaging", "medium", "pending", "Pack Block A-2 batch for Penang"),
    ("hazriq", 1, "transport_preparation", "medium", "pending", "Load lorry PEX 9012 for Penang"),
    ("hazriq", 1, "transport", "high", "pending", "Deliver Block A-2 batch to Penang Wholesale Market"),
    ("arif", 2, "waste_handling", "low", "pending", "Move rejected Block C-1 fruit to compost"),
]

# Post-harvest tables, children first so foreign keys never block a delete
POSTHARVEST_TABLES = [BatchEvent, HarvestGrade, Waste, Transport, AILog, Harvest, Schedule, MarketabilityPolicy]


def _at(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour, 0))


def _backdate(db, model, since_id: int, when: datetime) -> None:
    """Give rows created by the last step the date the step happened, so timelines read naturally"""
    db.query(model).filter(model.id > since_id).update({model.created_at: when}, synchronize_session=False)


def _last_id(db, model) -> int:
    row = db.query(model.id).order_by(model.id.desc()).first()
    return row[0] if row else 0


def wipe_postharvest(db) -> None:
    for model in POSTHARVEST_TABLES:
        db.query(model).delete(synchronize_session=False)
    db.commit()


def seed_postharvest(db, users) -> None:
    today = date.today()

    def step(when: datetime, action):
        """Run a service call, then backdate the batch events and records it created"""
        marks = {m: _last_id(db, m) for m in (BatchEvent, Waste, Transport)}
        result = action()
        for model, since in marks.items():
            _backdate(db, model, since, when)
        db.commit()
        return result

    for b in BATCHES:
        worker = users[b["worker"]]
        harvest_day = today - timedelta(days=b["days_ago"])
        sorted_kg, reason = b["sorted_out"] or (None, None)

        harvest = step(_at(harvest_day, 9), lambda: HarvestService.create_harvest(db, HarvestCreate(
            field_name=b["field"],
            harvest_date=harvest_day,
            quantity_kg=b["kg"],
            ripeness_level=b["ripeness"],
            notes=b["notes"],
            grades=b["grades"],
            non_marketable_kg=sorted_kg,
            non_marketable_reason=reason,
        ), worker.id))
        harvest.created_at = _at(harvest_day, 9)
        db.commit()

        if b["update"]:
            update = dict(b["update"])
            when = _at(today - timedelta(days=update.pop("days_ago")), 11)
            step(when, lambda: HarvestService.update_harvest(
                db, harvest.id, HarvestUpdate(**update), users["admin"].id
            ))

        for driver, destination, vehicle, cargo, days_ago, status, delivered_ago in b["transports"]:
            scheduled = today - timedelta(days=days_ago)
            # Booked the day before it was scheduled, never in the future
            booked = min(scheduled - timedelta(days=1), today)
            transport = step(_at(booked, 14), lambda: TransportService.create_transport(db, TransportCreate(
                harvest_id=harvest.id,
                driver_id=users[driver].id,
                destination=destination,
                vehicle_number=vehicle,
                scheduled_date=scheduled,
                cargo_weight_kg=cargo,
                status="pending",
            ), users["admin"].id))
            # Walk the delivery through its statuses so each one appears on the batch timeline
            if status in ("in_transit", "delivered"):
                step(_at(scheduled, 8), lambda: TransportService.update_transport_status(
                    db, transport.id, "in_transit", users[driver].id
                ))
            if status == "delivered":
                delivered = today - timedelta(days=delivered_ago)
                step(_at(delivered, 15), lambda: TransportService.update_transport_status(
                    db, transport.id, "delivered", users[driver].id
                ))
                transport.actual_delivery = delivered
                db.commit()

        for days_ago, waste_type, kg_, classification, disposal, notes in b["waste"]:
            day = today - timedelta(days=days_ago)
            step(_at(day, 16), lambda: WasteService.create_waste(db, WasteCreate(
                harvest_id=harvest.id,
                waste_type=waste_type,
                quantity_kg=kg_,
                waste_date=day,
                classification=classification,
                disposal_method=disposal,
                notes=notes,
            ), worker.id))

    for worker, offset, task_type, priority, status, details in SCHEDULES:
        db.add(Schedule(
            worker_id=users[worker].id,
            task_type=task_type,
            assigned_date=today + timedelta(days=offset),
            priority=priority,
            status=status,
            details=details,
        ))
    db.commit()

    print(
        f"Seeded {len(BATCHES)} harvest batches, "
        f"{db.query(Transport).count()} transports, {db.query(Waste).count()} waste records, "
        f"{db.query(BatchEvent).count()} timeline events and {len(SCHEDULES)} tasks."
    )


def seed(reset: bool = False, postharvest: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users = {}
        for username, email, password, role, full_name in ACCOUNTS:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                user = create_user(db, username, email, password, role=role, full_name=full_name)
                print(f"Created {role} account: {username} / {password}")
            users[username] = user

        if not db.query(QualityTarget).first():
            db.add(QualityTarget(max_spoilage_rate=5.0, max_rejection_rate=5.0))
            db.commit()

        if postharvest:
            wipe_postharvest(db)
            print("Removed existing post-harvest data.")
        elif db.query(Harvest).count() > 0:
            print("Harvest data already present - skipped. Use --postharvest to replace it.")
            return

        seed_postharvest(db, users)
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv, postharvest="--postharvest" in sys.argv)
