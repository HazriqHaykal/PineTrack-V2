"""
Batch lifecycle, quantity reconciliation and traceability events

All quantities are kilograms, handled as Decimal rounded to 0.01 kg:

  Marketable = from yield_calc.compute_yield(), the only marketable calculation:
               grade-based batches: marketable grades - spoilage - rejected
               legacy/ungraded:     Harvested - Spoilage - Rejected
  Reserved   = cargo weight of linked transports that are pending or in transit
  Delivered  = cargo weight of linked transports marked delivered
  Dispatched = in transit + delivered (cumulative: everything that has left the farm)
  Available  = Marketable - Reserved - Delivered
  Withheld   = what would be available on a batch rejected at grading; it cannot be allocated

The cargo weight of a batch-linked transport is the only source of allocated
quantity, and cancelled transports hold no stock.

Waste records linked to a batch describe losses already entered as spoilage or
rejection on that batch. They classify those losses and are never subtracted
from stock a second time.
"""

import json
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import desc, text
from sqlalchemy.orm import Session

from app.config import is_sqlite
from app.models import BatchEvent, Harvest, Transport, Waste
from app.services.yield_calc import GRADES, KG, ZERO, compute_yield, kg  # noqa: F401 - kg is re-exported

ACTIVE_TRANSPORT_STATUSES = ("pending", "in_transit")

LIFECYCLE_LABELS = {
    "awaiting_inspection": "Awaiting Inspection",
    "ready_for_dispatch": "Ready for Dispatch",
    "partially_allocated": "Partially Allocated",
    "fully_allocated": "Fully Allocated",
    "in_transit": "In Transit",
    "partially_delivered": "Partially Delivered",
    "delivered": "Delivered",
    "closed": "Closed / Rejected",
}

WASTE_POLICY = (
    "Waste records classify the spoilage and rejection already recorded on this batch. "
    "They are not subtracted from stock a second time."
)

HISTORY_UNAVAILABLE = (
    "This batch was recorded before activity tracking was introduced. "
    "Earlier changes cannot be reconstructed, so only activity since then is shown."
)


def fmt_kg(value) -> str:
    """Kilograms for messages, without trailing zeros: '50 kg', '12.5 kg'"""
    return f"{_num(kg(value))} kg"


def _num(value) -> str:
    text_value = format(Decimal(str(value)), "f")
    if "." in text_value:
        text_value = text_value.rstrip("0").rstrip(".")
    return text_value


def _label(status: Optional[str]) -> str:
    return (status or "").replace("_", " ").title()


def _float(value: Decimal) -> float:
    return float(value)


class BatchService:
    """Reconciliation, lifecycle and timeline logic for harvest batches"""

    # ── Locking ──────────────────────────────────────────────────────────

    @staticmethod
    def lock_batch(db: Session, batch_id: int) -> Optional[Harvest]:
        """
        Load a batch and hold it until the current transaction ends, so two
        requests cannot allocate the same stock at the same time.

        PostgreSQL takes a row lock with SELECT ... FOR UPDATE. SQLite ignores
        FOR UPDATE, so a no-op write takes SQLite's database-wide write lock
        instead; other writers wait until this transaction commits.

        Call this before changing the batch in the session: the row is reloaded.
        """
        if is_sqlite:
            db.execute(text("UPDATE harvest SET id = id WHERE id = :id"), {"id": batch_id})
        return (
            db.query(Harvest)
            .filter(Harvest.id == batch_id)
            .with_for_update()
            .populate_existing()
            .first()
        )

    # ── Quantities ───────────────────────────────────────────────────────

    @staticmethod
    def _transport_rows(db: Session, batch_ids: List[int]) -> List[Tuple]:
        """(id, harvest_id, status, cargo_weight_kg) for transports linked to the batches.

        A column query, so values come from the database rather than objects cached in the session.
        """
        if not batch_ids:
            return []
        return db.query(
            Transport.id, Transport.harvest_id, Transport.status, Transport.cargo_weight_kg
        ).filter(Transport.harvest_id.in_(batch_ids)).all()

    @staticmethod
    def _quantities(
        harvest: Harvest,
        transport_rows: List[Tuple],
        exclude_transport_id: Optional[int] = None,
        spoilage_kg=None,
        rejected_kg=None,
        grade_rows=None,
    ) -> Dict[str, Decimal]:
        """
        Reconcile one batch. spoilage_kg, rejected_kg and grade_rows
        ((grade, kg, is_marketable) tuples) override the stored values to test a proposed change.
        """
        if grade_rows is None:
            grade_rows = [(g.grade, g.quantity_kg, g.is_marketable) for g in harvest.grades]
        y = compute_yield(
            harvest.quantity_kg,
            harvest.spoilage_kg if spoilage_kg is None else spoilage_kg,
            harvest.rejected_kg if rejected_kg is None else rejected_kg,
            grade_rows,
            harvest.quality_grade,
        )
        harvested, spoilage, rejected, marketable = y["harvested"], y["spoilage"], y["rejected"], y["marketable"]

        pending = in_transit = delivered = ZERO
        unquantified = 0
        for transport_id, _, status, weight in transport_rows:
            if transport_id == exclude_transport_id or status == "cancelled":
                continue
            if weight is None:
                # Older transports may have no cargo weight; they cannot be counted
                unquantified += 1
                continue
            if status == "pending":
                pending += kg(weight)
            elif status == "in_transit":
                in_transit += kg(weight)
            elif status == "delivered":
                delivered += kg(weight)

        reserved = pending + in_transit
        return {
            "harvested": harvested,
            "spoilage": spoilage,
            "rejected": rejected,
            "marketable": marketable,
            "pending": pending,
            "in_transit": in_transit,
            "reserved": reserved,
            "delivered": delivered,
            "dispatched": in_transit + delivered,
            "available": marketable - reserved - delivered,
            "unquantified": unquantified,
            "yield": y,
        }

    @staticmethod
    def _sellable(harvest: Harvest, q: Dict[str, Decimal]) -> Tuple[Decimal, Decimal]:
        """(available, withheld): a rejected batch keeps its remaining stock out of allocation"""
        remaining = max(q["available"], ZERO)
        return (ZERO, remaining) if harvest.harvest_status == "rejected" else (remaining, ZERO)

    @staticmethod
    def quantities(db: Session, harvest: Harvest) -> Dict[str, Decimal]:
        return BatchService._quantities(harvest, BatchService._transport_rows(db, [harvest.id]))

    @staticmethod
    def lifecycle(harvest: Harvest, q: Dict[str, Decimal]) -> Dict:
        """
        Operational status, derived from the batch and its transports rather than chosen by a user.
        The grading status (pending/graded/processed/rejected) is kept separately and unchanged.

        Rules, first match wins (cancelled transports are ignored throughout):
          1. Graded as rejected, or nothing marketable           -> Closed / Rejected
          2. Any linked transport in transit                     -> In Transit
          3. Something delivered, nothing reserved or available  -> Delivered
          4. Something delivered                                 -> Partially Delivered
          5. Stock reserved, nothing left available              -> Fully Allocated
          6. Stock reserved                                      -> Partially Allocated
          7. Grading status still pending                        -> Awaiting Inspection
          8. Otherwise                                           -> Ready for Dispatch
        """
        available = q["available"]
        if harvest.harvest_status == "rejected":
            code, reason = "closed", "Batch was rejected at grading."
        elif q["marketable"] <= 0:
            code, reason = "closed", (
                "No marketable quantity remains after grading and spoilage."
                if q["yield"]["basis"] == "grade_based"
                else "No marketable quantity remains after spoilage and rejection."
            )
        elif q["in_transit"] > 0:
            code, reason = "in_transit", f"{fmt_kg(q['in_transit'])} on the road."
        elif q["delivered"] > 0 and q["reserved"] == 0 and available <= 0:
            code, reason = "delivered", f"All {fmt_kg(q['delivered'])} of marketable stock delivered."
        elif q["delivered"] > 0:
            code, reason = "partially_delivered", f"{fmt_kg(q['delivered'])} delivered, {fmt_kg(max(available, ZERO))} still available."
        elif q["reserved"] > 0 and available <= 0:
            code, reason = "fully_allocated", f"All {fmt_kg(q['reserved'])} reserved for transport."
        elif q["reserved"] > 0:
            code, reason = "partially_allocated", f"{fmt_kg(q['reserved'])} reserved, {fmt_kg(available)} still available."
        elif harvest.harvest_status == "pending":
            code, reason = "awaiting_inspection", "Waiting for quality grading."
        else:
            code, reason = "ready_for_dispatch", f"{fmt_kg(available)} available for transport."
        return {"code": code, "label": LIFECYCLE_LABELS[code], "reason": reason}

    @staticmethod
    def reconciliation(db: Session, harvest: Harvest) -> Dict:
        """Full quantity summary for one batch, in kg"""
        q = BatchService.quantities(db, harvest)
        waste_kg = sum(
            (kg(w) for (w,) in db.query(Waste.quantity_kg).filter(Waste.harvest_id == harvest.id)),
            ZERO,
        )
        y = q["yield"]
        losses = y["losses"]
        available, withheld = BatchService._sellable(harvest, q)
        return {
            "unit": "kg",
            "grading_basis": y["basis"],
            "marketable_yield_percent": _float(y["marketable_percent"]),
            "harvested_kg": _float(q["harvested"]),
            "spoilage_kg": _float(q["spoilage"]),
            "rejected_kg": _float(q["rejected"]),
            "non_marketable_kg": _float(y["non_marketable"] or ZERO),
            "rejected_at_sorting_kg": _float(y["rejected_at_sorting"] or ZERO),
            "marketable_kg": _float(q["marketable"]),
            "pending_kg": _float(q["pending"]),
            "in_transit_kg": _float(q["in_transit"]),
            "reserved_kg": _float(q["reserved"]),
            "delivered_kg": _float(q["delivered"]),
            "dispatched_kg": _float(q["dispatched"]),
            "available_kg": _float(available),
            "withheld_kg": _float(withheld),
            # Only non-zero for data saved before these checks existed
            "over_allocated_kg": _float(max(-q["available"], ZERO)),
            "unquantified_transports": q["unquantified"],
            "waste_recorded_kg": _float(waste_kg),
            "recorded_losses_kg": _float(losses),
            "unclassified_losses_kg": _float(max(losses - waste_kg, ZERO)),
            "waste_exceeds_losses_kg": _float(max(waste_kg - losses, ZERO)),
            "waste_policy": WASTE_POLICY,
        }

    @staticmethod
    def summaries(db: Session, harvests: List[Harvest]) -> List[Dict]:
        """Lifecycle and availability for many batches with a single transport query"""
        rows_by_batch: Dict[int, List[Tuple]] = {}
        for row in BatchService._transport_rows(db, [h.id for h in harvests]):
            rows_by_batch.setdefault(row[1], []).append(row)

        items = []
        for harvest in harvests:
            q = BatchService._quantities(harvest, rows_by_batch.get(harvest.id, []))
            lifecycle = BatchService.lifecycle(harvest, q)
            available, _ = BatchService._sellable(harvest, q)
            items.append({
                "harvest_id": harvest.id,
                "lifecycle_status": lifecycle["code"],
                "lifecycle_label": lifecycle["label"],
                "marketable_kg": _float(q["marketable"]),
                "reserved_kg": _float(q["reserved"]),
                "delivered_kg": _float(q["delivered"]),
                "available_kg": _float(available),
            })
        return items

    # ── Validation ───────────────────────────────────────────────────────

    @staticmethod
    def check_allocation(
        db: Session,
        batch_id: int,
        quantity_kg,
        exclude_transport_id: Optional[int] = None,
    ) -> Harvest:
        """
        Lock the batch and confirm it can supply quantity_kg for a transport.

        exclude_transport_id leaves out the transport being edited, so its
        previous amount is not counted against its new one.

        Raises:
            ValueError: with a message suitable for the user
        """
        harvest = BatchService.lock_batch(db, batch_id)
        if not harvest:
            raise ValueError(f"Harvest {batch_id} not found")
        if harvest.harvest_status == "rejected":
            raise ValueError(f"Batch {harvest.batch_number} was rejected and cannot be allocated for transport")
        if quantity_kg is None:
            raise ValueError("Cargo weight is required when a transport is linked to a harvest batch")

        amount = kg(quantity_kg)
        if amount <= 0:
            raise ValueError("Cargo weight must be greater than 0")

        q = BatchService._quantities(
            harvest, BatchService._transport_rows(db, [batch_id]), exclude_transport_id
        )
        if amount > q["available"]:
            raise ValueError(
                f"Only {fmt_kg(max(q['available'], ZERO))} of batch {harvest.batch_number} is available; "
                f"cannot allocate {fmt_kg(amount)}"
            )
        return harvest

    @staticmethod
    def check_harvest_change(
        db: Session, harvest: Harvest, spoilage_kg, rejected_kg, harvest_status, grade_rows=None
    ) -> None:
        """
        Refuse grading changes that would leave existing transport commitments
        without stock. Call with the batch locked; None means "unchanged".

        grade_rows: proposed grading breakdown as (grade, kg, is_marketable) tuples

        Raises:
            ValueError: with a message suitable for the user
        """
        rows = BatchService._transport_rows(db, [harvest.id])
        current = BatchService._quantities(harvest, rows)
        q = BatchService._quantities(
            harvest, rows, spoilage_kg=spoilage_kg, rejected_kg=rejected_kg, grade_rows=grade_rows,
        )

        committed = q["reserved"] + q["delivered"]
        if q["marketable"] < current["marketable"] and q["marketable"] < committed:
            if q["yield"]["basis"] == "grade_based":
                raise ValueError(
                    f"Batch {harvest.batch_number} has {fmt_kg(committed)} committed to transports "
                    f"(reserved or delivered). This change would leave only {fmt_kg(q['marketable'])} marketable. "
                    f"Cancel or reduce those transports first"
                )
            raise ValueError(
                f"Batch {harvest.batch_number} has {fmt_kg(committed)} committed to transports, so spoilage "
                f"and rejection can total at most {fmt_kg(q['harvested'] - committed)}"
            )

        if harvest_status == "rejected" and harvest.harvest_status != "rejected" and q["reserved"] > 0:
            raise ValueError(
                f"Batch {harvest.batch_number} has {fmt_kg(q['reserved'])} reserved on pending or in-transit "
                f"transports. Cancel or complete them before rejecting the batch"
            )

    # ── Timeline events ──────────────────────────────────────────────────

    @staticmethod
    def record_event(
        db: Session,
        batch_id: int,
        event_type: str,
        description: str,
        actor_id: Optional[int] = None,
        module: str = "harvest",
        record_id: Optional[int] = None,
        metadata: Optional[Dict] = None,
    ) -> BatchEvent:
        """Add a timeline event to the session; the caller's commit saves it with the change itself"""
        event = BatchEvent(
            batch_id=batch_id,
            event_type=event_type,
            actor_user_id=actor_id,
            related_module=module,
            related_record_id=record_id,
            description=description,
            event_metadata=json.dumps(metadata or {}, default=str),
        )
        db.add(event)
        return event

    @staticmethod
    def list_events(
        db: Session,
        batch_id: int,
        event_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 200,
    ) -> Tuple[List[BatchEvent], int]:
        """Newest first"""
        query = db.query(BatchEvent).filter(BatchEvent.batch_id == batch_id)
        if event_type:
            query = query.filter(BatchEvent.event_type == event_type)
        total = query.count()
        events = query.order_by(desc(BatchEvent.created_at), desc(BatchEvent.id)).offset(skip).limit(limit).all()
        return events, total

    @staticmethod
    def event_types(db: Session, batch_id: int) -> List[str]:
        rows = db.query(BatchEvent.event_type).filter(BatchEvent.batch_id == batch_id).distinct().all()
        return sorted(r[0] for r in rows)

    @staticmethod
    def history_complete(db: Session, batch_id: int) -> bool:
        """True when the batch's creation was recorded, i.e. it was created after tracking began"""
        return db.query(BatchEvent.id).filter(
            BatchEvent.batch_id == batch_id, BatchEvent.event_type == "harvest_created"
        ).first() is not None

    @staticmethod
    def serialize_event(event: BatchEvent, viewer_id: int, viewer_is_admin: bool) -> Dict:
        actor = event.actor
        if actor is None:
            actor_name = "System"
        elif viewer_is_admin or actor.id == viewer_id or actor.role == "admin":
            actor_name = actor.full_name or actor.username
        else:
            # Workers do not see other workers' names
            actor_name = "Another worker"
        return {
            "id": event.id,
            "batch_id": event.batch_id,
            "event_type": event.event_type,
            "actor_user_id": event.actor_user_id if viewer_is_admin else None,
            "actor_name": actor_name,
            "related_module": event.related_module,
            "related_record_id": event.related_record_id,
            "description": event.description,
            "metadata": json.loads(event.event_metadata or "{}"),
            "created_at": event.created_at,
        }

    # Harvest

    @staticmethod
    def harvest_snapshot(harvest: Harvest) -> Dict:
        return {
            "quality_grade": harvest.quality_grade,
            "ripeness_level": harvest.ripeness_level,
            "harvest_status": harvest.harvest_status,
            "spoilage_kg": harvest.spoilage_kg,
            "rejected_kg": harvest.rejected_kg,
            "notes": harvest.notes,
            "grades": BatchService.grade_snapshot(harvest),
            "marketable_grades": harvest.marketable_grades,
            "policy_version": harvest.grading_policy_version,
            "sorted_out_kg": harvest.rejected_at_sorting_kg,
            "marketable_kg": harvest.marketable_yield_kg,
            "marketable_percent": harvest.marketable_yield_percent,
        }

    @staticmethod
    def grade_snapshot(harvest: Harvest) -> Optional[Dict[str, float]]:
        quantities = harvest.grade_quantities
        return {g: quantities.get(g, 0.0) for g in GRADES} if quantities is not None else None

    @staticmethod
    def describe_grades(grades: Dict[str, float]) -> str:
        return ", ".join(f"{g} {fmt_kg(grades.get(g, 0))}" for g in GRADES)

    @staticmethod
    def log_grading(db: Session, before: Optional[Dict], harvest: Harvest, actor_id: Optional[int]) -> None:
        """
        One event when the grading breakdown is first recorded or changed, with
        the previous and new quantities and the recalculated marketable yield.
        before is a harvest_snapshot, or None for a batch that was just created.
        """
        after = BatchService.harvest_snapshot(harvest)
        old_grades = before["grades"] if before else None
        if after["grades"] is None or old_grades == after["grades"]:
            return

        policy = ", ".join(after["marketable_grades"] or []) or "none"
        version = after["policy_version"]
        sorted_out = after["sorted_out_kg"] or 0
        old_sorted_out = (before or {}).get("sorted_out_kg") or 0
        yield_text = (
            f"Marketable yield {fmt_kg(after['marketable_kg'])} ({_num(after['marketable_percent'])}%) "
            f"with grades {policy} counted as marketable"
            + (f" (policy v{version})." if version else ".")
        )
        if old_grades is None:
            event_type = "grading_recorded"
            if before and before.get("quality_grade") in GRADES:
                lead = (f"Grading breakdown recorded, replacing the single legacy Grade {before['quality_grade']}: "
                        f"{BatchService.describe_grades(after['grades'])}.")
            else:
                lead = f"Grading breakdown recorded: {BatchService.describe_grades(after['grades'])}."
            if sorted_out:
                lead += f" Non-marketable at sorting: {fmt_kg(sorted_out)} (logged in Waste Management)."
            description = f"{lead} {yield_text}"
        else:
            event_type = "grading_updated"
            changed = [
                f"{g} {fmt_kg(old_grades.get(g, 0))} to {fmt_kg(after['grades'].get(g, 0))}"
                for g in GRADES if kg(old_grades.get(g, 0)) != kg(after["grades"].get(g, 0))
            ]
            if kg(old_sorted_out) != kg(sorted_out):
                changed.append(f"non-marketable {fmt_kg(old_sorted_out)} to {fmt_kg(sorted_out)}")
            description = (f"Grade quantities changed: {', '.join(changed) or 'none'}. "
                           f"Marketable yield recalculated: {yield_text}")
            if before["policy_version"] and version and before["policy_version"] != version:
                description += f" Re-graded under policy v{version} (previously v{before['policy_version']})."

        BatchService.record_event(
            db, harvest.id, event_type, description, actor_id, "harvest", harvest.id,
            {
                "previous_grades": old_grades,
                "new_grades": after["grades"],
                "previous_non_marketable_kg": old_sorted_out if before else None,
                "new_non_marketable_kg": sorted_out,
                "previous_marketable_kg": before["marketable_kg"] if before else None,
                "new_marketable_kg": after["marketable_kg"],
                "previous_marketable_percent": before["marketable_percent"] if before else None,
                "new_marketable_percent": after["marketable_percent"],
                "marketable_grades": after["marketable_grades"],
                "previous_policy_version": before["policy_version"] if before else None,
                "policy_version": version,
            },
        )

    @staticmethod
    def log_harvest_created(db: Session, harvest: Harvest, actor_id: Optional[int]) -> None:
        BatchService.record_event(
            db, harvest.id, "harvest_created",
            f"Batch {harvest.batch_number} registered with {fmt_kg(harvest.quantity_kg)} from {harvest.field_name}.",
            actor_id, "harvest", harvest.id,
            {
                "quantity_kg": harvest.quantity_kg,
                "field_name": harvest.field_name,
                "harvest_date": harvest.harvest_date,
                "quality_grade": harvest.quality_grade,
                "ripeness_level": harvest.ripeness_level,
            },
        )

    @staticmethod
    def log_harvest_changes(db: Session, before: Dict, harvest: Harvest, actor_id: Optional[int]) -> None:
        """One event per kind of change; nothing when nothing changed"""
        after = BatchService.harvest_snapshot(harvest)
        tracked = ("quality_grade", "ripeness_level", "harvest_status", "spoilage_kg", "rejected_kg", "notes")
        changed = {k: {"from": before[k], "to": after[k]} for k in tracked if before[k] != after[k]}

        # A new grading breakdown also sets the overall grade; the grading event covers it
        if before["grades"] != after["grades"]:
            BatchService.log_grading(db, before, harvest, actor_id)
            changed.pop("quality_grade", None)

        def record(event_type: str, description: str, keys: List[str]) -> None:
            BatchService.record_event(
                db, harvest.id, event_type, description, actor_id, "harvest", harvest.id,
                {"changes": {k: changed[k] for k in keys}},
            )

        quality_keys = [k for k in ("quality_grade", "ripeness_level") if k in changed]
        if quality_keys:
            parts = []
            if "quality_grade" in changed:
                grade = harvest.quality_grade
                parts.append("Batch marked ungraded." if grade == "ungraded" else f"Grade {grade} assigned.")
            if harvest.ripeness_level is not None:
                parts.append(f"Ripeness level: {_num(harvest.ripeness_level)}/10.")
            record("quality_updated", " ".join(parts), quality_keys)

        if "harvest_status" in changed:
            record(
                "status_changed",
                f"Grading status changed from {_label(before['harvest_status'])} to {_label(harvest.harvest_status)}.",
                ["harvest_status"],
            )

        marketable = fmt_kg(harvest.marketable_yield_kg)
        if "spoilage_kg" in changed:
            record(
                "spoilage_changed",
                f"Spoilage changed from {fmt_kg(before['spoilage_kg'])} to {fmt_kg(harvest.spoilage_kg)}. "
                f"Marketable quantity is now {marketable}.",
                ["spoilage_kg"],
            )
        if "rejected_kg" in changed:
            record(
                "rejection_changed",
                f"Rejected quantity changed from {fmt_kg(before['rejected_kg'])} to {fmt_kg(harvest.rejected_kg)}. "
                f"Marketable quantity is now {marketable}.",
                ["rejected_kg"],
            )

        if "notes" in changed:
            # The note text itself is left out of the event
            BatchService.record_event(db, harvest.id, "harvest_updated", "Batch notes updated.",
                                      actor_id, "harvest", harvest.id, {"fields": ["notes"]})

    # Transport

    @staticmethod
    def transport_snapshot(transport: Transport) -> Dict:
        return {
            "harvest_id": transport.harvest_id,
            "status": transport.status,
            "cargo_weight_kg": transport.cargo_weight_kg,
            "destination": transport.destination,
            "scheduled_date": transport.scheduled_date,
        }

    @staticmethod
    def log_transport_change(
        db: Session, before: Optional[Dict], transport: Transport, actor_id: Optional[int]
    ) -> None:
        """Events for a created (before=None) or updated transport, on every batch it affects"""
        after = BatchService.transport_snapshot(transport)
        old_batch = before["harvest_id"] if before else None
        new_batch = after["harvest_id"]
        dest = transport.destination
        weight = transport.cargo_weight_kg

        def record(batch_id: int, event_type: str, description: str, extra: Optional[Dict] = None) -> None:
            metadata = {"destination": dest, "cargo_weight_kg": weight, "status": transport.status}
            metadata.update(extra or {})
            BatchService.record_event(db, batch_id, event_type, description, actor_id,
                                      "transport", transport.id, metadata)

        if old_batch and old_batch != new_batch:
            old_weight = before["cargo_weight_kg"]
            record(old_batch, "transport_unlinked",
                   f"Delivery to {before['destination']} unlinked from this batch"
                   + (f"; {fmt_kg(old_weight)} no longer allocated." if old_weight else "."),
                   {"cargo_weight_kg": old_weight, "moved_to_batch_id": new_batch})

        if new_batch and new_batch != old_batch:
            amount = f"{fmt_kg(weight)} allocated" if weight else "Allocated (no cargo weight recorded)"
            status_note = "" if transport.status == "pending" else f" Status: {_label(transport.status)}."
            record(new_batch, "transport_allocated",
                   f"{amount} for delivery to {dest} on {transport.scheduled_date:%d %b %Y}.{status_note}",
                   {"scheduled_date": transport.scheduled_date})
            return

        if not new_batch or not before:
            return

        # Same batch: allocation edits, then status changes
        changes = {
            k: {"from": before[k], "to": after[k]}
            for k in ("cargo_weight_kg", "destination", "scheduled_date")
            if before[k] != after[k]
        }
        if changes:
            parts = []
            if "cargo_weight_kg" in changes:
                parts.append(f"cargo {fmt_kg(before['cargo_weight_kg'])} to {fmt_kg(weight)}")
            if "destination" in changes:
                parts.append(f"destination {before['destination']} to {dest}")
            if "scheduled_date" in changes:
                parts.append(f"date {before['scheduled_date']:%d %b %Y} to {transport.scheduled_date:%d %b %Y}")
            record(new_batch, "allocation_changed",
                   "Allocation changed: " + ", ".join(parts) + ".", {"changes": changes})

        old_status, new_status = before["status"], transport.status
        if old_status == new_status:
            return
        status_change = {"changes": {"status": {"from": old_status, "to": new_status}}}
        if new_status == "in_transit":
            record(new_batch, "transport_dispatched",
                   f"Delivery to {dest} changed from {_label(old_status)} to In Transit.", status_change)
        elif new_status == "delivered":
            record(new_batch, "transport_delivered",
                   f"{fmt_kg(weight)} confirmed delivered to {dest}." if weight else f"Delivery to {dest} completed.",
                   status_change)
        elif new_status == "cancelled":
            released = f"; {fmt_kg(weight)} released back to available stock" if weight else ""
            record(new_batch, "transport_cancelled", f"Delivery to {dest} cancelled{released}.", status_change)
        else:
            record(new_batch, "transport_status_changed",
                   f"Delivery to {dest} changed from {_label(old_status)} to {_label(new_status)}.", status_change)

    @staticmethod
    def log_transport_removed(db: Session, transport: Transport, actor_id: Optional[int]) -> None:
        if not transport.harvest_id:
            return
        weight = transport.cargo_weight_kg
        released = f"; {fmt_kg(weight)} released" if weight and transport.status in ACTIVE_TRANSPORT_STATUSES else ""
        BatchService.record_event(
            db, transport.harvest_id, "transport_removed",
            f"{_label(transport.status)} delivery to {transport.destination} deleted{released}.",
            actor_id, "transport", transport.id,
            {"destination": transport.destination, "cargo_weight_kg": weight, "status": transport.status},
        )

    # Waste

    @staticmethod
    def waste_snapshot(waste: Waste) -> Dict:
        return {
            "harvest_id": waste.harvest_id,
            "waste_type": waste.waste_type,
            "quantity_kg": waste.quantity_kg,
            "classification": waste.classification,
            "disposal_method": waste.disposal_method,
            "waste_date": waste.waste_date,
        }

    @staticmethod
    def log_waste_change(db: Session, before: Optional[Dict], waste: Waste, actor_id: Optional[int]) -> None:
        """Events for a created (before=None) or updated waste record"""
        after = BatchService.waste_snapshot(waste)
        old_batch = before["harvest_id"] if before else None
        new_batch = after["harvest_id"]
        kind = waste.waste_type.replace("_", " ")

        def record(batch_id: int, event_type: str, description: str, extra: Optional[Dict] = None) -> None:
            metadata = {"waste_type": waste.waste_type, "quantity_kg": waste.quantity_kg,
                        "classification": waste.classification}
            metadata.update(extra or {})
            BatchService.record_event(db, batch_id, event_type, description, actor_id, "waste", waste.id, metadata)

        if old_batch and old_batch != new_batch:
            record(old_batch, "waste_unlinked",
                   f"{fmt_kg(before['quantity_kg'])} {before['waste_type'].replace('_', ' ')} waste record unlinked from this batch.",
                   {"moved_to_batch_id": new_batch})

        if new_batch and new_batch != old_batch:
            record(new_batch, "waste_recorded",
                   f"{fmt_kg(waste.quantity_kg)} of {kind} waste recorded ({waste.classification}"
                   + (f", {waste.disposal_method}" if waste.disposal_method else "") + ").")
            return

        if not new_batch or not before:
            return

        changes = {k: {"from": before[k], "to": after[k]} for k in after if k != "harvest_id" and before[k] != after[k]}
        if changes:
            parts = []
            for key, change in changes.items():
                old, new = change["from"], change["to"]
                if key == "quantity_kg":
                    old, new = fmt_kg(old), fmt_kg(new)
                parts.append(f"{key.replace('_kg', '').replace('_', ' ')} {old or 'none'} to {new or 'none'}")
            record(new_batch, "waste_updated", "Waste record updated: " + ", ".join(parts) + ".", {"changes": changes})

    @staticmethod
    def log_waste_removed(db: Session, waste: Waste, actor_id: Optional[int]) -> None:
        if not waste.harvest_id:
            return
        BatchService.record_event(
            db, waste.harvest_id, "waste_removed",
            f"{fmt_kg(waste.quantity_kg)} {waste.waste_type.replace('_', ' ')} waste record removed.",
            actor_id, "waste", waste.id,
            {"waste_type": waste.waste_type, "quantity_kg": waste.quantity_kg, "classification": waste.classification},
        )
