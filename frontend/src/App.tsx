import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { authService } from './services/auth'

// Auth
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BatchDetails from './pages/BatchDetails'
import TransportDetails from './pages/TransportDetails'

// Admin pages
import AdminDashboard  from './pages/admin/AdminDashboard'
import UserManagement  from './pages/admin/UserManagement'
import AIInsights      from './pages/admin/AIInsights'
import Reports         from './pages/admin/Reports'
import AdminSettings   from './pages/admin/Settings'
import HarvestPage     from './pages/admin/Harvest'
import TransportPage   from './pages/admin/Transport'
import SchedulePage    from './pages/admin/Schedule'
import WastePage       from './pages/admin/Waste'
import AnalyticsPage   from './pages/admin/Analytics'
import ProfitPlanner   from './pages/admin/ProfitPlanner'

// Worker pages
import WorkerDashboard  from './pages/worker/WorkerDashboard'
import HarvestEntry     from './pages/worker/HarvestEntry'
import TransportUpdate  from './pages/worker/TransportUpdate'
import WasteSubmit      from './pages/worker/WasteSubmit'
import MySchedule       from './pages/worker/MySchedule'
import Profile          from './pages/worker/Profile'
import MyRecords        from './pages/worker/MyRecords'
import SulurManagement from './pages/admin/SulurManagement'

// ─── Route guards ──────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  if (!authService.isAdmin()) {
    return <Navigate to="/my-tasks" replace />
  }
  return <>{children}</>
}

function WorkerRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  if (authService.isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// Redirect / based on role after login
function HomeRedirect() {
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />
  return authService.isAdmin()
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/my-tasks" replace />
}

// ─── App ───────────────────────────────────────────────────────────────────────

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Sulur Inventory module (same URLs as before; now behind the route guards) ── */}
        <Route path="/admin/sulur"   element={<AdminRoute><SulurManagement /></AdminRoute>} />
        <Route path="/admin/sulur/*" element={<AdminRoute><SulurManagement /></AdminRoute>} />
        {/* Picks the admin or worker layout itself; the API authorises every request */}
        <Route path="/worker/sulur"   element={<ProtectedRoute><SulurManagement /></ProtectedRoute>} />
        <Route path="/worker/sulur/*" element={<ProtectedRoute><SulurManagement /></ProtectedRoute>} />
        <Route path="/sulur"   element={<ProtectedRoute><SulurManagement /></ProtectedRoute>} />
        <Route path="/sulur/*" element={<ProtectedRoute><SulurManagement /></ProtectedRoute>} />

        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Smart home redirect */}
        <Route path="/" element={<HomeRedirect />} />

        {/* ── Admin routes ── */}
        <Route path="/dashboard"  element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/harvest"    element={<AdminRoute><HarvestPage /></AdminRoute>} />
        {/* Admins see any batch, workers their own; the backend enforces this */}
        <Route path="/harvest/:batchId" element={<ProtectedRoute><BatchDetails /></ProtectedRoute>} />
        <Route path="/transport"  element={<AdminRoute><TransportPage /></AdminRoute>} />
        {/* Admins and the transport's own creator/driver; the API enforces which */}
        <Route path="/transport/:transportId" element={<ProtectedRoute><TransportDetails /></ProtectedRoute>} />
        <Route path="/schedule"   element={<AdminRoute><SchedulePage /></AdminRoute>} />
        <Route path="/waste"      element={<AdminRoute><WastePage /></AdminRoute>} />
        <Route path="/analytics"  element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
        <Route path="/profit-planner" element={<AdminRoute><ProfitPlanner /></AdminRoute>} />
        {/* The former Ask page now lives in the agent's Ask tab */}
        <Route path="/ai"         element={<Navigate to="/admin/ai-insights" replace />} />

        <Route path="/admin/ai-insights" element={<AdminRoute><AIInsights /></AdminRoute>} />
        <Route path="/admin/reports"     element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="/admin/users"       element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="/admin/settings"    element={<AdminRoute><AdminSettings /></AdminRoute>} />

        {/* ── Worker routes ── */}
        <Route path="/my-tasks"         element={<WorkerRoute><WorkerDashboard /></WorkerRoute>} />
        <Route path="/harvest-entry"    element={<WorkerRoute><HarvestEntry /></WorkerRoute>} />
        <Route path="/transport-update" element={<WorkerRoute><TransportUpdate /></WorkerRoute>} />
        <Route path="/waste-submit"     element={<WorkerRoute><WasteSubmit /></WorkerRoute>} />
        <Route path="/my-schedule"      element={<WorkerRoute><MySchedule /></WorkerRoute>} />
        <Route path="/my-records"       element={<WorkerRoute><MyRecords /></WorkerRoute>} />
        <Route path="/profile"          element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
