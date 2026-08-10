import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Sprout,
  Truck,
  Calendar,
  Recycle,
  BarChart3,
  Brain,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCircle,
} from 'lucide-react'
import { authService } from '../../services/auth'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Sprout,          label: 'Harvest',   path: '/harvest'   },
  { icon: Truck,           label: 'Transport', path: '/transport' },
  { icon: Calendar,        label: 'Schedule',  path: '/schedule'  },
  { icon: Recycle,         label: 'Waste',     path: '/waste'     },
  { icon: BarChart3,       label: 'Analytics', path: '/analytics' },
  { icon: Brain,           label: 'AI Assist', path: '/ai'        },
]

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = authService.getUser()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <aside
      className={`group flex flex-col bg-slate-900 text-white shrink-0 transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-60'
      } h-full`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-700/60 h-16 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl leading-none">🍍</span>
            <div className="min-w-0">
              <p className="font-bold text-sm text-white leading-tight">PineTrack</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">v2.0</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-2 rounded-md transition-all shrink-0 ${
            collapsed
              ? 'bg-slate-700 text-white hover:bg-green-600'
              : 'opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + '/')
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User block */}
      <div className="px-2 pb-3 border-t border-slate-700/60 pt-3 space-y-0.5">
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <UserCircle size={16} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.full_name || user?.username || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {user?.role}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
