# Authentication System - Quick Reference

## API Endpoints

### 1. Register User
```
POST /api/auth/register
Content-Type: application/json

Request:
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Password123",
  "full_name": "John Doe"
}

Response (200):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "worker",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
}

Errors:
- 400: Username or email already exists
- 422: Validation error (invalid email, short password, etc.)
```

### 2. Login
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "username": "john_doe",
  "password": "Password123"
}

Response (200):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": { ... }
}

Errors:
- 401: Invalid credentials
- 422: Validation error
```

### 3. Get Current User
```
GET /api/auth/me
Authorization: Bearer <access_token>

Response (200):
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "role": "worker",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}

Errors:
- 401: Invalid or missing token
- 404: User not found
```

### 4. Refresh Token
```
POST /api/auth/refresh
Authorization: Bearer <access_token>

Response (200):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": { ... }
}

Errors:
- 401: Invalid or missing token
- 404: User not found
```

## File Structure

```
backend/
├── app/
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── rbac.py                 ← Role-based access control
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py         ← Auth business logic
│   ├── routers/
│   │   ├── __init__.py
│   │   └── auth.py                 ← Auth endpoints
│   ├── config.py                   ← Configuration (modified)
│   ├── models.py                   ← User model (modified)
│   ├── schemas.py                  ← Pydantic schemas (modified)
│   ├── main.py                     ← FastAPI app (modified)
│   └── __init__.py
├── tests/
│   ├── __init__.py
│   └── test_auth.py                ← Auth tests
├── requirements.txt
├── AUTH_SYSTEM.md                  ← Detailed documentation
└── IMPLEMENTATION_SUMMARY.md       ← This file

```

## Usage Examples

### Python Client
```python
import requests

BASE_URL = "http://localhost:8000/api/auth"

# Register
resp = requests.post(f"{BASE_URL}/register", json={
    "username": "john",
    "email": "john@example.com",
    "password": "Pass123"
})
token = resp.json()["access_token"]

# Login
resp = requests.post(f"{BASE_URL}/login", json={
    "username": "john",
    "password": "Pass123"
})
token = resp.json()["access_token"]

# Get user
headers = {"Authorization": f"Bearer {token}"}
resp = requests.get(f"{BASE_URL}/me", headers=headers)
user = resp.json()

# Refresh token
resp = requests.post(f"{BASE_URL}/refresh", headers=headers)
new_token = resp.json()["access_token"]
```

### JavaScript/Frontend
```javascript
const API = "http://localhost:8000/api/auth";

// Register
async function register(username, email, password) {
  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  });
  return res.json();
}

// Login
async function login(username, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

// Get current user
async function getMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return res.json();
}

// Refresh token
async function refreshToken(token) {
  const res = await fetch(`${API}/refresh`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  return res.json();
}
```

## Protecting Routes

### Require Any Authenticated User
```python
from fastapi import APIRouter, Depends
from app.middleware.rbac import get_current_user

router = APIRouter()

@router.get("/harvest/list")
def list_harvests(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    # List harvests for this user
    return {"harvests": [...]}
```

### Require Worker or Admin
```python
from app.middleware.rbac import require_worker

@router.post("/harvest/create")
def create_harvest(
    harvest_data: dict,
    current_user: dict = Depends(require_worker)
):
    user_id = current_user["user_id"]
    # Create harvest for this user
    return {"id": 1, ...}
```

### Require Admin Only
```python
from app.middleware.rbac import require_admin

@router.get("/admin/users")
def list_all_users(current_user: dict = Depends(require_admin)):
    # List all users
    return {"users": [...]}
```

## Environment Configuration

Create `.env` file:
```
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pinetrack

# Security
SECRET_KEY=your-random-secret-key-change-in-production

# Environment
ENVIRONMENT=development
```

## Token Structure

JWT tokens contain:
```json
{
  "sub": "1",              // User ID
  "role": "worker",        // User role (admin, worker, user)
  "exp": 1704067200        // Expiration time (Unix timestamp)
}
```

## User Roles

- **admin** - Full system access
- **worker** - Standard user (farm operations)
- **user** - Deprecated (use worker instead)

## Password Requirements

- Minimum 6 characters
- Can contain letters, numbers, symbols
- Case-sensitive

## Running Tests

```bash
# Run all tests
pytest backend/tests/test_auth.py -v

# Run specific test
pytest backend/tests/test_auth.py::test_password_hashing -v

# Run with coverage
pytest backend/tests/test_auth.py --cov=app --cov-report=html
```

## Common Issues

### "Invalid token" error
- Token has expired (24 hours)
- Token was modified or corrupted
- SECRET_KEY has changed
- Try refreshing token

### "Worker access required" error
- User has insufficient role
- Contact admin to upgrade role
- Create new admin user via database

### "Username already exists" error
- Username is taken
- Choose different username
- Try logging in with existing account

## Server Startup

```bash
# Development (with auto-reload)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once server is running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Security Checklist

- [ ] Change SECRET_KEY before production
- [ ] Use HTTPS/TLS in production
- [ ] Configure database with strong passwords
- [ ] Enable CORS restrictions
- [ ] Monitor authentication logs
- [ ] Implement rate limiting
- [ ] Set secure database connection
- [ ] Use environment variables for secrets
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Token Lifecycle

1. **Creation**: User registers or logs in → Token issued
2. **Usage**: Token sent in Authorization header
3. **Expiration**: After 24 hours, token becomes invalid
4. **Refresh**: Use /refresh endpoint to get new token
5. **Invalidation**: Token becomes invalid after logout (if implemented)

## Support Documentation

- **AUTH_SYSTEM.md** - Detailed architecture and configuration
- **IMPLEMENTATION_SUMMARY.md** - Implementation overview
- **tests/test_auth.py** - Test examples
- **FastAPI Docs** - https://fastapi.tiangolo.com/
- **python-jose** - https://python-jose.readthedocs.io/
