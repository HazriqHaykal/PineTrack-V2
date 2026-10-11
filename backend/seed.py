"""
Seed the database with login accounts and a small, fully linked sample data set.

Run from the backend folder:
    python seed.py            # add accounts + sample data if the database is empty
    python seed.py --reset    # wipe every table first, then seed

Accounts created:
    admin   / admin123    (admin)
    hazriq  / worker123   (worker)
    ibrahim / worker123   (worker)
    arif    / worker123   (worker)

Every record is linked: each transport and waste record points at a harvest batch,
each delivery and task is assigned to a worker, so every page has data for every login.
"""

import sys
from datetime import date, timedelta

from app.config import Base, SessionLocal, engine
from app.models import Harvest, QualityTarget, Schedule, Transport, User, Waste
from app.services.auth_service import create_user

ACCOUNTS = [
    ("admin", "admin@pinetrack.com", "admin123", "admin", "Admin"),
    ("hazriq", "hazriq@pinetrack.com", "worker123", "worker", "Hazriq"),
    ("ibrahim", "ibrahim@pinetrack.com", "worker123", "worker", "Ibrahim"),
    ("arif", "arif@pinetrack.com", "worker123", "worker", "Arif"),
]

# (worker, days ago, field, kg, grade, ripeness, status, spoilage kg, rejected kg, notes)
HARVESTS = [
    ("hazriq", 1, "Block A-1", 180, "A", 8, "pending", 0, 0, None),
    ("ibrahim", 3, "Block A-2", 150, "A", 8, "graded", 3, 2, None),
    ("arif", 5, "Block B-1", 120, "B", 6, "processed", 5, 3, None),
    ("hazriq", 8, "Block B-2", 95, "C", 5, "processed", 8, 6, "Some bruising"),
    ("ibrahim", 12, "Block C-1", 60, "D", 3, "rejected", 12, 15, "Overripe"),
    ("arif", 16, "Block A-1", 200, "A", 9, "processed", 2, 1, "Excellent batch"),
]

# (harvest index, driver, destination, vehicle, cargo kg, scheduled days ago, status, delivered days ago)
TRANSPORTS = [
    (0, "hazriq", "Kuala Lumpur Central Market", "WXY 1234", 180, -1, "pending", None),
    (1, "ibrahim", "Johor Bahru Fresh Produce Hub", "JHF 5678", 145, 0, "in_transit", None),
    (2, "arif", "Penang Wholesale Market", "PEX 9012", 112, 4, "delivered", 4),
    (5, "hazriq", "Seremban Distribution Centre", "NSA 3456", 197, 15, "delivered", 14),
]

# (harvest index, days ago, type, kg, classification, disposal, notes)
WASTE = [
    (2, 5, "damaged", 5, "compostable", "compost", "Damaged during sorting"),
    (3, 8, "overripe", 8, "compostable", "compost", None),
    (4, 12, "rotten", 12, "compostable", "compost", "From rejected batch"),
    (4, 12, "unused_parts", 15, "recyclable", "animal feed", "Crowns and peel"),
]

# (worker, days from today, task, priority, status, details)
SCHEDULES = [
    ("hazriq", 0, "harvest", "high", "in_progress", "Harvest Block A-3"),
    ("hazriq", 1, "transport", "high", "pending", "Deliver batch to Kuala Lumpur Central Market"),
    ("ibrahim", 0, "transport", "high", "in_progress", "Deliver batch to Johor Bahru"),
    ("ibrahim", 2, "inspection", "medium", "pending", "Ripeness check - Block C-1"),
    ("arif", -1, "inspection", "medium", "completed", "Field condition check - Block B"),
    ("arif", 1, "maintenance", "low", "pending", "Service irrigation pump"),
]


def seed(reset: bool = False) -> None:
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

        if db.query(Harvest).count() > 0:
            print("Sample data already present - skipped. Use --reset to start over.")
            return

        today = date.today()

        # Oldest first so batch numbers follow harvest order
        by_index = {}
        ordered = sorted(enumerate(HARVESTS), key=lambda item: -item[1][1])
        for number, (index, row) in enumerate(ordered, start=1):
            worker, days_ago, field, kg, grade, ripeness, status, spoilage, rejected, notes = row
            harvest_date = today - timedelta(days=days_ago)
            harvest = Harvest(
                user_id=users[worker].id,
                batch_number=f"PT-{harvest_date.year}-{number:03d}",
                field_name=field,
                harvest_date=harvest_date,
                quantity_kg=kg,
                quality_grade=grade,
                ripeness_level=ripeness,
                harvest_status=status,
                spoilage_kg=spoilage,
                rejected_kg=rejected,
                notes=notes,
            )
            db.add(harvest)
            by_index[index] = harvest
        db.flush()
        harvests = [by_index[i] for i in range(len(HARVESTS))]

        for h_index, driver, destination, vehicle, cargo, days_ago, status, delivered_ago in TRANSPORTS:
            db.add(Transport(
                user_id=users["admin"].id,
                driver_id=users[driver].id,
                harvest_id=harvests[h_index].id,
                destination=destination,
                driver_name=users[driver].full_name,
                vehicle_number=vehicle,
                scheduled_date=today - timedelta(days=days_ago),
                actual_delivery=today - timedelta(days=delivered_ago) if delivered_ago is not None else None,
                cargo_weight_kg=cargo,
                status=status,
            ))

        for h_index, days_ago, waste_type, kg, classification, disposal, notes in WASTE:
            db.add(Waste(
                user_id=harvests[h_index].user_id,
                harvest_id=harvests[h_index].id,
                waste_type=waste_type,
                quantity_kg=kg,
                waste_date=today - timedelta(days=days_ago),
                classification=classification,
                disposal_method=disposal,
                notes=notes,
            ))

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
            f"Seeded {len(HARVESTS)} harvests, {len(TRANSPORTS)} transports, "
            f"{len(WASTE)} waste records and {len(SCHEDULES)} schedules."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
