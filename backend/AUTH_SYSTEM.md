# PineTrack V2.0 - Authentication & RBAC System Documentation

## Overview
This document describes the complete authentication and role-based access control (RBAC) system for PineTrack V2.0.

## Architecture

### Components

#### 1. **Middleware: Role-Based Access Control** (`app/middleware/rbac.py`)
Provides JWT token verification and role-based access control for protected routes.

**Key Functions:**
- `verify_token(credentials: HTTPAuthorizationCredentials)` - Decodes and verifies JWT tokens
- `require_admin(current_user)` - Enforces admin role requirement
- `require_worker(current_user)` - Enforces worker or admin role
- `get_current_user(current_user)` - Returns authenticated user info

**Security:** Uses HTTPBearer for Authorization header parsing with JWT signature verification

#### 2. **Authentication Service** (`app/services/auth_service.py`)
Business logic layer for authentication operations.

**Key Functions:**
- `hash_password(password)` - Hashes passwords using bcrypt
- `verify_password(password, hashed_password)` - Verifies password against hash
- `create_access_token(user_id, role, expires_delta)` - Creates JWT tokens with configurable expiration
- `authenticate_user(db, username, password)` - Validates user credentials
- `create_user(db, username, email, password, role)` - Registers new users

**Security:**
- Passwords: bcrypt hashing with passlib
- Tokens: JWT with HS256 algorithm
- Default token expiration: 24 hours

#### 3. **Authentication Router** (`app/routers/auth.py`)
REST API endpoints for authentication operations.

**Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/me` - Get current user info (requires auth)
- `POST /api/auth/refresh` - Refresh expired token (requires auth)

**Response Format:**
```json
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
```

## User Roles

Three roles are supported:
- **admin** - Full system access, can manage users and permissions
- **worker** - Standard user access for farm operations
- **user** - (deprecated, use worker instead)

Default role for new registrations: `worker`

## Database Schema

**Users Table:**
- `id` (Integer) - Primary key
- `username` (String, unique) - Login identifier
- `email` (String, unique) - Email address
- `password_hash` (String) - bcrypt hashed password
- `full_name` (String, optional) - User's full name
- `is_active` (Boolean) - Account status
- `role` (String) - User role (admin, worker, user)
- `created_at` (DateTime) - Account creation timestamp
- `updated_at` (DateTime) - Last update timestamp

## Configuration

**Settings** (`app/config.py`):
- `secret_key` - JWT signing key (set via SECRET_KEY env var)
- `algorithm` - JWT algorithm (HS256)
- `access_token_expire_minutes` - Token expiration (default: 1440 = 24 hours)
- `database_url` - PostgreSQL connection string

## Usage Examples

### 1. Register a New User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "SecurePassword123",
    "full_name": "John Doe"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePassword123"
  }'
```

### 3. Access Protected Endpoint
```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### 4. Refresh Token
```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Authorization: Bearer <access_token>"
```

## Protected Route Example

To protect a route with admin role requirement:

```python
from fastapi import APIRouter, Depends
from app.middleware.rbac import require_admin

router = APIRouter()

@router.get("/admin/users")
def get_all_users(current_user: dict = Depends(require_admin)):
    # Only admins can access this endpoint
    return {"message": "Admin access granted"}
```

## Error Handling

**401 Unauthorized:**
- Invalid or missing token
- Expired token
- Invalid credentials during login

**403 Forbidden:**
- User lacks required role for endpoint
- Example: Worker trying to access admin endpoint

**400 Bad Request:**
- Duplicate username or email during registration
- Invalid email format
- Password too short (minimum 6 characters)

## Security Features

1. **Password Security:**
   - Bcrypt hashing with automatic salt generation
   - Passwords never stored in plain text

2. **Token Security:**
   - JWT with signature verification
   - Configurable expiration (default 24 hours)
   - Refresh endpoint for getting new tokens

3. **Access Control:**
   - Role-based route protection
   - HTTPBearer token extraction from Authorization header
   - User isolation (users can only access their own data)

## Testing

Run authentication tests:
```bash
pytest backend/tests/test_auth.py -v
```

Test coverage includes:
- Password hashing and verification
- Token creation and validation
- User registration and duplicate prevention
- Login with valid/invalid credentials
- Protected endpoint access

## Dependencies

Required packages:
- `python-jose[cryptography]` - JWT handling
- `passlib[bcrypt]` - Password hashing
- `fastapi` - Web framework
- `sqlalchemy` - ORM
- `pydantic` - Data validation
- `pydantic-settings` - Configuration management

## File Structure

```
backend/
├── app/
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── rbac.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py
│   ├── routers/
│   │   ├── __init__.py
│   │   └── auth.py
│   ├── config.py
│   ├── models.py
│   ├── schemas.py
│   ├── main.py
│   └── __init__.py
├── tests/
│   ├── __init__.py
│   └── test_auth.py
└── requirements.txt
```

## Future Enhancements

Potential improvements:
1. OAuth2 integration (Google, GitHub)
2. Multi-factor authentication (MFA)
3. Token blacklisting for logout
4. Password reset via email
5. Social login options
6. Rate limiting on auth endpoints
7. Audit logging for authentication events
8. SAML support for enterprise

## Troubleshooting

**"Invalid token" error:**
- Ensure token is not expired
- Check that SECRET_KEY hasn't changed
- Verify Authorization header format: `Bearer <token>`

**"Worker access required":**
- User's role doesn't match endpoint requirements
- Request admin user to upgrade account role

**Database connection errors:**
- Verify DATABASE_URL environment variable
- Ensure PostgreSQL server is running
- Check database credentials and permissions
