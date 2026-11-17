# PineTrack V2.0 - Complete API Reference

## Base URL
```
http://localhost:8000/api
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication Endpoints (`/api/auth`)

### POST /auth/register
Register new user and get access token

**Request:**
```json
{
  "username": "john_worker",
  "email": "john@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

**Response (201):**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john_worker",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "worker",
    "is_active": true,
    "created_at": "2026-05-20T10:00:00",
    "updated_at": "2026-05-20T10:00:00"
  }
}
```

### POST /auth/login
Login with credentials

**Request:**
```json
{
  "username": "john_worker",
  "password": "SecurePass123"
}
```

**Response (200):** Same as register

### GET /auth/me
Get current authenticated user

**Response (200):** User object

### POST /auth/refresh
Refresh access token before expiry

**Response (200):** New token object

---

## 🌾 Harvest Management (`/api/harvest`)

### POST /harvest/
Create new harvest record

**Request:**
```json
{
  "field_name": "Field A",
  "harvest_date": "2026-05-20",
  "quantity_kg": 200,
  "grades": {"A": 100, "B": 60, "C": 25, "D": 15},
  "ripeness_level": 7.5,
  "notes": "Good yield"
}
```

**Response (201):** Harvest object with ID, including the calculated yield:
`grading_basis` (`grade_based`, `legacy` or `ungraded`), `grade_quantities`, `marketable_grades`,
`graded_marketable_kg`, `non_marketable_kg`, `marketable_yield_kg`, `marketable_yield_percent`,
`grading_yield_percent`, `grading_policy_version`.

**Grading breakdown (FR08):** kg per grade, entered by the farmer. Grades left out count as 0 kg.
The grades must add up to `quantity_kg` exactly (0.01 kg precision); none may be negative or exceed it.
Leave `grades` out for a batch that has not been graded yet. A batch with grades is saved as `graded`,
and its `quality_grade` becomes the single grade letter or `"mixed"`.

**Non-marketable fruit:** `non_marketable_kg` (with `grades`) is fruit sorted out as unsellable at harvest,
and `non_marketable_reason` is one of `damaged`, `rotten`, `overripe`, `other`. Then
A + B + C + D + non_marketable_kg = quantity_kg. It is stored as the batch's rejection (`rejected_at_sorting_kg`)
and a linked waste record is created for it. That record classifies the loss and is not subtracted again.
`rejected_kg` is the total rejection: non-marketable at sorting + `rejected_after_grading_kg`.

**Legacy:** `quality_grade` (A, B, C, D) without `grades` still records one overall grade.

**Marketable quantity (FR09)**, calculated only in `app/services/yield_calc.py`:
- Grade-based: marketable grades − spoilage − rejected. Every grade (D included) is marketable by
  default; spoiled and rejected fruit comes out of the graded quantities, so nothing is counted twice.
  A grade the admin excludes in the policy is left out of marketable stock as well.
- Legacy / ungraded: harvested − spoilage − rejected.

---

### GET /harvest/{id}
Get harvest record by ID

**Response (200):** Harvest object

**Authorization:** Workers see only their own, admins see all

---

### GET /harvest/
List harvest records (paginated)

**Query Parameters:**
- `skip`: int = 0 - Pagination offset
- `limit`: int = 100 - Records per page (max 1000)

**Response (200):**
```json
{
  "items": [...],
  "total": 5,
  "skip": 0,
  "limit": 100
}
```

---

### PATCH /harvest/{id}
Update harvest record

**Request:**
```json
{
  "grades": {"A": 110, "B": 50, "C": 25, "D": 15},
  "spoilage_kg": 5,
  "notes": "Updated notes"
}
```

**Response (200):** Updated harvest object

**Grade-based batches:** `quality_grade` comes from the grades and cannot be set separately (400).
Spoilage plus rejection cannot exceed the marketable graded quantity. A change that would leave less
marketable stock than is reserved or delivered on transports is refused (400); transports are never
changed. Re-grading applies the current marketability policy and is logged as a `grading_updated` event.

---

### DELETE /harvest/{id}
Delete harvest record (admin only)

**Response (204):** No content

**Response (409):** transports or waste records are still linked to the batch

---

### GET /harvest/statistics/summary
Get harvest statistics

**Query Parameters:**
- `start_date`: date (optional)
- `end_date`: date (optional)

**Response (200):**
```json
{
  "total_harvests": 5,
  "total_quantity_kg": 750.5,
  "average_quantity_kg": 150.1,
  "quality_grades": {
    "A": 2,
    "B": 2,
    "ungraded": 1
  },
  "grading": {
    "graded_batches": 3,
    "harvested_kg": 600,
    "marketable_kg": 540,
    "marketable_yield_percent": 90.0,
    "grade_kg": {"A": 300, "B": 180, "C": 60, "D": 60},
    "legacy_batches": 1,
    "ungraded_batches": 1
  }
}
```

`grading` is the farm-wide yield, weighted by quantity: sum(marketable kg) / sum(harvested kg) x 100,
over grade-based batches only. Legacy and ungraded batches are counted separately, not averaged in.
The same block appears in `/api/analytics/overview` as `grading`, with a monthly `yield_trend`.

---

### GET /harvest/field/{field_name}
Get all harvests from specific field

**Response (200):**
```json
{
  "field_name": "Field A",
  "count": 3,
  "harvests": [...]
}
```

---

### GET /harvest/policy/marketability
Current marketability policy (any signed-in user; the harvest form uses it for the live preview)

```json
{
  "version": 1,
  "marketable_grades": ["A", "B", "C", "D"],
  "non_marketable_grades": [],
  "note": "Initial default ...",
  "created_at": "...",
  "created_by": null,
  "is_current": true,
  "explanation": "..."
}
```

### PUT /harvest/policy/marketability
Save a new policy version (admin only). Batches already graded keep the version they were graded under.

```json
{ "marketable_grades": ["A", "B"], "note": "Grade C goes to processing" }
```

### GET /harvest/policy/marketability/history
Every policy version, newest first (admin only)

---

### GET /harvest/lifecycle/overview
Lifecycle status and available quantity for every batch the user can see (workers: their own)

**Response (200):**
```json
{ "items": [ { "harvest_id": 6, "lifecycle_status": "fully_allocated", "lifecycle_label": "Fully Allocated",
               "marketable_kg": 180, "reserved_kg": 180, "delivered_kg": 0, "available_kg": 0 } ] }
```

---

### GET /harvest/{id}/details
Batch overview, lifecycle, quantity reconciliation, linked transports and waste.
Workers may open only batches they recorded (403 otherwise). `hidden_count` is the number of linked records they cannot open.

**Response (200):**
```json
{
  "batch": { "...": "same fields as GET /harvest/{id}" },
  "created_by": "Hazriq",
  "lifecycle": { "code": "partially_allocated", "label": "Partially Allocated", "reason": "100 kg reserved, 50 kg still available." },
  "quantities": { "...": "see /reconciliation" },
  "transports": { "items": [], "hidden_count": 0 },
  "waste": { "items": [], "hidden_count": 0 },
  "history_complete": true,
  "history_note": null
}
```

---

### GET /harvest/{id}/lifecycle
`{ "code", "label", "reason" }` only.

---

### GET /harvest/{id}/reconciliation
Quantities in kg, calculated by the backend.

**Response (200):**
```json
{
  "unit": "kg", "harvested_kg": 200, "spoilage_kg": 5, "rejected_kg": 5, "marketable_kg": 190,
  "pending_kg": 100, "in_transit_kg": 0, "reserved_kg": 100, "delivered_kg": 40, "dispatched_kg": 40,
  "available_kg": 50, "withheld_kg": 0, "over_allocated_kg": 0, "unquantified_transports": 0,
  "waste_recorded_kg": 10, "recorded_losses_kg": 10, "unclassified_losses_kg": 0, "waste_exceeds_losses_kg": 0,
  "waste_policy": "Waste records classify the spoilage and rejection already recorded on this batch. ..."
}
```

---

### GET /harvest/{id}/events
Traceability timeline, newest first.

**Query Parameters:**
- `event_type`: string (optional), e.g. `transport_delivered`
- `skip`, `limit` (default 200, max 500)

**Response (200):**
```json
{
  "total": 1, "skip": 0, "limit": 200,
  "items": [ { "id": 7, "batch_id": 6, "event_type": "transport_delivered", "actor_name": "Admin",
               "actor_user_id": 1, "related_module": "transport", "related_record_id": 4,
               "description": "150 kg confirmed delivered to Kuala Lumpur Central Market.",
               "metadata": { "changes": { "status": { "from": "in_transit", "to": "delivered" } } },
               "created_at": "2026-11-09T08:30:00Z" } ],
  "event_types": ["harvest_created", "transport_delivered"],
  "history_complete": true,
  "history_note": null
}
```
Workers see other workers as "Another worker", and `actor_user_id` is omitted for them.

Event types: `harvest_created`, `quality_updated`, `status_changed`, `spoilage_changed`, `rejection_changed`, `harvest_updated`,
`transport_allocated`, `allocation_changed`, `transport_unlinked`, `transport_dispatched`, `transport_delivered`,
`transport_cancelled`, `transport_status_changed`, `transport_removed`, `waste_recorded`, `waste_updated`, `waste_unlinked`, `waste_removed`.

---

### GET /harvest/{id}/transports, GET /harvest/{id}/waste
Linked records only: `{ "items": [...], "hidden_count": 0 }`.

---

## 🚚 Transport Management (`/api/transport`)

A transport with a `harvest_id` reserves its `cargo_weight_kg` from that batch. Creating or editing one returns **400** if the batch is rejected, the cargo weight is missing, or the weight exceeds what is available (e.g. `Only 50 kg of batch PT-2026-014 is available; cannot allocate 60 kg`). A delivered batch transport cannot change its batch or weight, and cannot be cancelled (400) or deleted (409).

### POST /transport/
Create transport job

**Request:**
```json
{
  "harvest_id": 1,
  "destination": "Storage Facility A",
  "transport_date": "2026-05-20",
  "vehicle_id": "VAN-001",
  "quantity_kg": 100.0,
  "notes": "Rush delivery"
}
```

**Response (201):** Transport object

---

### GET /transport/{id}
Get transport record

**Response (200):** Transport object

---

### GET /transport/
List transport records

**Query Parameters:**
- `status`: string (optional) - Filter by status
- `skip`: int = 0
- `limit`: int = 100

**Valid Statuses:** pending, in_transit, delivered, cancelled

---

### PATCH /transport/{id}
Update transport record

**Request:**
```json
{
  "status": "in_transit",
  "notes": "Loaded successfully"
}
```

**Response (200):** Updated transport object

---

### PATCH /transport/{id}/status
Update status with validation

**Query Parameter:**
- `new_status`: string - New status value

**Response (200):** Updated transport object

---

### DELETE /transport/{id}
Delete transport (admin only)

**Response (204):** No content

---

### GET /transport/efficiency/statistics
Get transport efficiency metrics

**Query Parameters:**
- `start_date`: date (optional)
- `end_date`: date (optional)

**Response (200):**
```json
{
  "total_transports": 10,
  "total_quantity_kg": 1500.0,
  "delivered_count": 8,
  "in_transit_count": 1,
  "pending_count": 1,
  "delivery_rate_percent": 80.0
}
```

---

### GET /transport/destination/{destination}
Get transports to specific destination

**Response (200):**
```json
{
  "destination": "Storage Facility A",
  "count": 3,
  "transports": [...]
}
```

---

## ♻️ Waste Management (`/api/waste`)

### POST /waste/
Create waste record

**Request:**
```json
{
  "waste_type": "damaged",
  "quantity_kg": 25.5,
  "waste_date": "2026-05-20",
  "disposal_method": "compost",
  "harvest_id": 1,
  "notes": "Storm damage"
}
```

**Response (201):** Waste object

**Valid Waste Types:** rotten, damaged, unused_parts, other  
**Valid Disposal Methods:** compost, recycle, discard, donate

---

### GET /waste/{id}
Get waste record

**Response (200):** Waste object

---

### GET /waste/
List waste records

**Query Parameters:**
- `waste_type`: string (optional) - Filter by type
- `skip`: int = 0
- `limit`: int = 100

---

### PATCH /waste/{id}
Update waste record

**Request:**
```json
{
  "disposal_method": "donate",
  "notes": "Donated to local shelter"
}
```

**Response (200):** Updated waste object

---

### DELETE /waste/{id}
Delete waste record (admin only)

**Response (204):** No content

---

### GET /waste/statistics/summary
Get waste statistics

**Query Parameters:**
- `start_date`: date (optional)
- `end_date`: date (optional)

**Response (200):**
```json
{
  "total_waste_kg": 150.5,
  "total_records": 6,
  "by_type": {
    "rotten": 50.0,
    "damaged": 75.5,
    "unused_parts": 25.0
  },
  "by_disposal_method": {
    "compost": 100.0,
    "donate": 50.5
  },
  "waste_percentage": 13.06
}
```

---

## 📅 Schedule Management (`/api/schedule`)

### POST /schedule/
Create schedule (admin only)

**Request:**
```json
{
  "task_type": "harvest",
  "scheduled_date": "2026-05-21",
  "scheduled_time": "08:00:00",
  "priority": "high",
  "notes": "Priority harvest"
}
```

**Response (201):** Schedule object

**Valid Task Types:** harvest, transport, maintenance, inspection  
**Valid Priorities:** low, normal, high, urgent

---

### GET /schedule/{id}
Get schedule record

**Response (200):** Schedule object

---

### GET /schedule/
List schedules with filters

**Query Parameters:**
- `task_type`: string (optional)
- `priority`: string (optional)
- `status`: string (optional)
- `scheduled_date`: date (optional)
- `skip`: int = 0
- `limit`: int = 100

**Valid Statuses:** pending, assigned, in_progress, completed, cancelled

---

### PATCH /schedule/{id}
Update schedule (admin only)

**Request:**
```json
{
  "priority": "urgent",
  "status": "assigned",
  "notes": "Updated priority"
}
```

**Response (200):** Updated schedule object

---

### PATCH /schedule/{id}/status
Update status

**Query Parameter:**
- `new_status`: string

**Response (200):** Updated schedule object

---

### DELETE /schedule/{id}
Delete schedule (admin only)

**Response (204):** No content

---

### POST /schedule/{id}/assign
Assign schedule to worker (admin only)

**Query Parameter:**
- `worker_id`: int - Worker to assign to

**Response (200):** Updated schedule object with worker assigned

---

### GET /schedule/worker/my-schedule
Get my assigned tasks

**Query Parameters:**
- `scheduled_date`: date (optional)

**Response (200):**
```json
{
  "date": "2026-05-21",
  "worker_id": 1,
  "schedules": [...],
  "count": 3
}
```

---

### GET /schedule/worker/{worker_id}/schedule
Get worker's schedule

**Query Parameters:**
- `scheduled_date`: date (optional)

**Response (200):** Worker's scheduled tasks

---

## 🤖 AI Recommendations (`/api/ai`)

### POST /ai/predict/harvest-timing
Get harvest timing recommendation

**Query Parameters:**
- `harvest_id`: int - Harvest ID
- `ripeness_level`: float (0-10) - Ripeness score
- `days_since_last_harvest`: int (default: 0) - Days since last harvest
- `field_condition_score`: float (0-10, default: 5) - Field condition

**Response (200):**
```json
{
  "recommendation": "Harvest Now",
  "quality_prediction": "High",
  "transport_priority": "Urgent",
  "confidence_score": 0.95,
  "reasoning": {
    "ripeness_level": 8,
    "days_since_harvest": 25,
    "field_condition": 7,
    "total_score": 85
  }
}
```

---

### POST /ai/predict/waste-classification
Classify waste type and disposal

**Query Parameters:**
- `quality_grade`: string (A, B, C, D)
- `damage_level`: float (0-10, default: 0)
- `age_days`: int (default: 0)

**Response (200):**
```json
{
  "waste_type": "damaged",
  "disposal_method": "compost",
  "confidence_score": 0.9,
  "quality_grade": "C",
  "damage_level": 8,
  "age_days": 5
}
```

---

### GET /ai/logs
List AI prediction logs

**Query Parameters:**
- `prediction_type`: string (optional)
- `model_version`: string (optional)
- `skip`: int = 0
- `limit`: int = 100

**Response (200):**
```json
{
  "items": [...],
  "total": 25,
  "skip": 0,
  "limit": 100
}
```

---

### GET /ai/logs/{id}
Get specific AI log

**Response (200):** AI log object

---

### GET /ai/metrics
Get AI model performance metrics

**Response (200):**
```json
{
  "total_predictions": 42,
  "average_confidence": 0.87,
  "by_prediction_type": {
    "harvest_timing": 25,
    "waste_classification": 17
  },
  "by_model_version": {
    "v2.0": 42
  }
}
```

---

## 🧮 Harvest & Profit Planner (`/api/planner`, admin only)

Deterministic planning estimates (FR12). Nothing is stored and no farm records change.
Calculated only in `app/services/planner_service.py`; no AI is used.

### POST /planner/calculate
```json
{
  "mode": "target_profit",
  "target_profit": 10000,
  "selling_price_per_kg": 3.5,
  "variable_cost_per_kg": 1.5,
  "fixed_cost": 2000,
  "marketable_yield_percent": 80,
  "productivity_kg_per_ha": 40000
}
```
For `"mode": "forecast"`, send exactly one of `planned_harvest_kg` or `land_area_ha` instead of `target_profit`.
The prices and costs above are example inputs only, not market rates.

**Response (200):** `harvest_kg`, `marketable_kg`, `land_ha`, `revenue`, `variable_cost`, `fixed_cost`,
`total_cost`, `profit`, `profit_margin_percent` (null when revenue is 0), `break_even_marketable_kg`,
`assumptions`, `steps` (each formula with the figures used), `notes`, `disclaimer`, `calculation_version`.

Formulas (variable cost is per **marketable** kg):
- Marketable kg = Harvest kg × yield rate; Revenue = Marketable kg × price
- Total cost = Fixed + Marketable kg × variable cost; Profit = Revenue − Total cost
- Required marketable kg = (Target + Fixed) / (Price − Variable cost); Required harvest = Required marketable / yield rate
- Land (ha) = Harvest kg / productivity; Margin % = Profit / Revenue × 100

Decimal arithmetic; money and percentages rounded to 0.01 (half up), kg to 0.01, ha to 0.001.
In target mode, quantities and land are rounded **up** so the target is still met.

**Errors:** 422 for missing or out-of-range inputs; 400 when the selling price is not above the
variable cost in target-profit mode (no harvest quantity can reach the target).

### POST /planner/compare
`{"scenarios": [{"label": "Conservative", "inputs": {...}}, ...]}` (1–5). Each item returns
`result`, or `error` if that scenario's target cannot be reached.

### POST /planner/what-if
Body: the same `PlannerInput` as `/planner/calculate`. Returns Conservative, Expected and Optimistic
versions of that plan (`scenarios`, each with the `inputs` used and a `result` or `error`), plus the
adjustment `rules`. Expected is the input unchanged. The others are fixed, hypothetical adjustments, not predictions:

| Assumption | Conservative | Optimistic |
|---|---|---|
| Selling price | −10% | +10% |
| Variable cost per marketable kg | +10% | −10% |
| Fixed cost | +10% | −10% |
| Marketable yield | −5 percentage points (min 1%) | +5 percentage points (max 100%) |
| Productivity | −10% | +10% |

The target profit, planned harvest or land area is the same in every scenario.

### GET /planner/historical-yield?months=12
Quantity-weighted marketable yield (total marketable kg / total harvested kg) over batches in the
period with recorded grade quantities. Legacy and ungraded batches are excluded and counted.
`available` is false (and the yield null) when fewer than 3 graded batches exist.

---

## Error Responses

### 400 Bad Request
Invalid input data or business logic violation
```json
{
  "detail": "Quantity must be greater than 0"
}
```

### 401 Unauthorized
Missing or invalid token
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
Insufficient permissions
```json
{
  "detail": "Only admins can delete harvests"
}
```

### 404 Not Found
Resource not found
```json
{
  "detail": "Harvest not found"
}
```

### 422 Unprocessable Entity
Validation error
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Successful delete |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Auth required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation error |

---

## Role-Based Access

### Admin
- ✅ View all records
- ✅ Create schedules
- ✅ Delete any record
- ✅ Assign workers
- ✅ View all statistics

### Worker
- ✅ View own records
- ✅ Create harvest/transport/waste records
- ✅ Update own records
- ✅ View own statistics
- ❌ Cannot delete records
- ❌ Cannot manage other users

---

## Example Workflows

### Complete Harvest Workflow
```
1. Create Harvest → POST /harvest/
2. Get AI Recommendation → POST /ai/predict/harvest-timing
3. Create Transport Job → POST /transport/
4. Update Transport Status → PATCH /transport/{id}/status
5. Log Waste → POST /waste/
6. Get Statistics → GET /harvest/statistics/summary
```

### Daily Schedule Workflow
```
1. Create Schedule → POST /schedule/ (Admin)
2. Assign to Worker → POST /schedule/{id}/assign (Admin)
3. Worker Views Tasks → GET /schedule/worker/my-schedule (Worker)
4. Update Task Status → PATCH /schedule/{id}/status (Worker)
5. View Metrics → GET /ai/metrics
```

---

## Pagination
All list endpoints support pagination:
- Default limit: 100 records
- Maximum limit: 1000 records
- Use `skip` to offset results

**Example:**
```
GET /harvest/?skip=0&limit=50
```

---

**API Version**: 2.0.0  
**Last Updated**: 2026-05-20  
**Status**: ✅ Production Ready
