# 🍍 PineTrack V2.0 - Command Reference & Quick Start

## 🚀 Quick Start (5 minutes)

### 1️⃣ Start Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

✅ Runs on: http://localhost:8000

### 2️⃣ Start Frontend
```bash
cd frontend
npm install
npm run dev
```

✅ Runs on: http://localhost:5173

### 3️⃣ Login
- **URL**: http://localhost:5173/login
- **Username**: admin
- **Password**: admin123

---

## 📁 Directory Structure

```
PinetrackV2/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── database.py        # DB connection
│   │   ├── services/          # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── harvest_service.py
│   │   │   ├── transport_service.py
│   │   │   ├── waste_service.py
│   │   │   ├── schedule_service.py
│   │   │   └── ai_service.py
│   │   ├── routers/           # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── harvest.py
│   │   │   ├── transport.py
│   │   │   ├── waste.py
│   │   │   ├── schedule.py
│   │   │   └── ai.py
│   │   └── middleware/        # Auth middleware
│   ├── tests/                 # Test files
│   ├── requirements.txt       # Python dependencies
│   └── .env.example
│
├── frontend/                  # React application
│   ├── src/
│   │   ├── App.tsx           # Main routing
│   │   ├── LoginPage.tsx     # Auth page
│   │   ├── RegisterPage.tsx  # Auth page
│   │   ├── DashboardPage.tsx # Main dashboard
│   │   ├── HarvestPage.tsx   # Module page
│   │   ├── TransportPage.tsx # Module page
│   │   ├── SchedulePage.tsx  # Module page
│   │   ├── WastePage.tsx     # Module page
│   │   ├── AnalyticsPage.tsx # Module page
│   │   ├── Navbar.tsx        # Navigation
│   │   ├── api.ts            # API client
│   │   ├── auth.ts           # Auth service
│   │   ├── types.ts          # TypeScript types
│   │   ├── main.tsx          # React entry
│   │   └── index.css         # Styling
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── database/
│   └── schema.sql            # Database schema
│
└── docs/
    ├── BUILD_STATUS.md
    ├── EXECUTIVE_SUMMARY.md
    ├── FRONTEND_QUICK_REFERENCE.md
    ├── API_REFERENCE.md
    └── README.md
```

---

## 🔌 API Endpoints Quick Reference

### Authentication
```bash
POST   /api/auth/login           # Login
POST   /api/auth/register        # Register
POST   /api/auth/refresh         # Refresh token
GET    /api/auth/verify          # Verify token
```

### Harvest
```bash
GET    /api/harvest              # List harvests
POST   /api/harvest              # Create harvest
GET    /api/harvest/{id}         # Get harvest
PATCH  /api/harvest/{id}         # Update harvest
DELETE /api/harvest/{id}         # Delete harvest
GET    /api/harvest/stats        # Get statistics
```

### Transport
```bash
GET    /api/transport            # List transports
POST   /api/transport            # Create transport
PATCH  /api/transport/{id}       # Update transport
DELETE /api/transport/{id}       # Delete transport
GET    /api/transport/efficiency # Get efficiency metrics
```

### Waste
```bash
GET    /api/waste                # List waste records
POST   /api/waste                # Create waste
GET    /api/waste/{id}           # Get waste record
DELETE /api/waste/{id}           # Delete waste
GET    /api/waste/stats          # Get statistics
```

### Schedule
```bash
GET    /api/schedule             # List schedules
POST   /api/schedule             # Create schedule
PATCH  /api/schedule/{id}        # Update schedule
DELETE /api/schedule/{id}        # Delete schedule
GET    /api/schedule/stats       # Get statistics
```

### AI
```bash
GET    /api/ai/recommendation/{id}  # Get recommendation
POST   /api/ai/predict              # Make prediction
GET    /api/ai/logs                 # Get AI logs
GET    /api/ai/performance          # Get performance metrics
```

---

## 🧪 Testing API with curl

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Harvest Stats
```bash
curl -X GET http://localhost:8000/api/harvest/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create Harvest
```bash
curl -X POST http://localhost:8000/api/harvest \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name":"Field A",
    "harvest_date":"2026-05-21",
    "quantity_kg":150.5,
    "quality_grade":"A",
    "notes":"Good condition"
  }'
```

---

## 📝 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pinetrack

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24

# Environment
ENVIRONMENT=development
DEBUG=true

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)
```env
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_PREFIX=/api
```

---

## 🛠️ Common Commands

### Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
python -m uvicorn app.main:app --reload

# Run tests
pytest backend/tests/

# Check API docs
# Open browser to http://localhost:8000/docs
```

### Frontend
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Run linter (if configured)
npm run lint
```

---

## 🔐 Authentication Flow

1. **Register** → `POST /api/auth/register`
   - Sends: username, email, password, full_name
   - Returns: access_token, user object

2. **Login** → `POST /api/auth/login`
   - Sends: username, password
   - Returns: access_token, user object

3. **Store Token** → localStorage
   - Stored in: `access_token`
   - Stored user: `user` (JSON)

4. **Use Token** → All requests
   - Header: `Authorization: Bearer {token}`
   - Auto-added by API client

5. **401 Response** → Auto-redirect
   - Clears token
   - Redirects to /login

---

## 📊 Database Setup

### Create Database
```bash
createdb pinetrack
```

### Apply Schema
```bash
psql pinetrack < database/schema.sql
```

### Run Migrations (if using Alembic)
```bash
alembic upgrade head
```

---

## 🚀 Deployment

### Production Build
```bash
# Frontend
cd frontend
npm run build
# Output: dist/

# Backend
# Configure .env for production
# Run with gunicorn or similar
```

### Docker (Optional)
```bash
# Build backend image
docker build -t pinetrack-backend backend/

# Build frontend image
docker build -t pinetrack-frontend frontend/

# Run
docker-compose up
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 8000 in use** | `lsof -i :8000` then kill process |
| **Port 5173 in use** | `npm run dev -- --port 5174` |
| **npm install fails** | Clear cache: `npm cache clean --force` |
| **Backend not responding** | Check it's running: `curl http://localhost:8000` |
| **Database error** | Verify PostgreSQL is running and DB exists |
| **Login fails** | Check test user exists in database |
| **CORS error** | Verify `ALLOWED_ORIGINS` in backend .env |
| **Token expired** | Use refresh endpoint or re-login |

---

## 📊 Useful Tools

### API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Frontend DevTools
- **React DevTools**: Browser extension
- **Redux DevTools**: For state debugging
- **Vite CLI**: Built-in fast reload

### Database
- **pgAdmin**: GUI for PostgreSQL
- **psql**: Command line client

---

## 📈 Project Status Commands

### Check Backend Health
```bash
curl http://localhost:8000/
```

### Check Frontend Build
```bash
cd frontend && npm run build
```

### Run Tests
```bash
cd backend && pytest -v
```

---

## 🎯 Development Workflow

1. **Start Backend** (Terminal 1)
   ```bash
   cd backend && python -m uvicorn app.main:app --reload
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend && npm run dev
   ```

3. **Open Browser**
   ```
   http://localhost:5173
   ```

4. **Test Login**
   ```
   Username: admin
   Password: admin123
   ```

5. **Develop**
   - Edit files (auto-reload)
   - Frontend: Vite hot reload
   - Backend: Uvicorn reload

---

## 📞 Support

### Documentation
- See `BUILD_STATUS.md` for full project status
- See `EXECUTIVE_SUMMARY.md` for overview
- See `API_REFERENCE.md` for endpoint details
- See `FRONTEND_QUICK_REFERENCE.md` for UI guide

### Quick Checks
```bash
# Backend running?
curl -s http://localhost:8000/ && echo "✅ Backend OK" || echo "❌ Backend DOWN"

# Frontend building?
cd frontend && npm run build && echo "✅ Frontend OK" || echo "❌ Frontend ERROR"

# Database connected?
# Check backend logs for connection messages
```

---

## ✅ Pre-Launch Checklist

- [ ] Python 3.8+ installed
- [ ] Node.js 16+ installed
- [ ] PostgreSQL running
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Test user created in database
- [ ] Backend running on 8000
- [ ] Frontend running on 5173
- [ ] Login works
- [ ] Dashboard loads

---

**Last Updated**: 2026-05-21  
**Status**: ✅ Ready to Run  
**Next Step**: `cd backend && python -m uvicorn app.main:app --reload`

# Terminal 1 — Backend (from project root)
  cd C:\Users\User\Documents\Projects\PinetrackV2\backend
  python -m uvicorn app.main:app --reload
  # API runs at http://localhost:8000
  # Docs at http://localhost:8000/docs

  # Terminal 2 — Frontend (from project root)
  cd C:\Users\User\Documents\Projects\PinetrackV2\frontend
  npm run dev
  # UI runs at http://localhost:5173

  Both .env files are already created, so no setup needed — just run those
  two commands in separate terminals.