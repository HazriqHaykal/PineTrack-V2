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
  "quantity_kg": 150.5,
  "quality_grade": "A",
  "notes": "Good yield"
}
```

**Response (201):** Harvest object with ID

**Quality Grades:** A, B, C, D (optional, defaults to "ungraded")

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
  "quality_grade": "A",
  "notes": "Updated notes"
}
```

**Response (200):** Updated harvest object

---

### DELETE /harvest/{id}
Delete harvest record (admin only)

**Response (204):** No content

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
  }
}
```

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

## 🚚 Transport Management (`/api/transport`)

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
