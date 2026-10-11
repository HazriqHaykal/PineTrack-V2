import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Sprout, Truck, Calendar, Recycle,
  Brain, BarChart3, FileText, Users, Settings,
  ChevronLeft, ChevronRight, LogOut, UserCircle, Shield,
} from 'lucide-react'
import { authService } from '../../services/auth'

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard'  },
      { icon: Sprout,          label: 'Harvest',          path: '/harvest'    },
      { icon: Truck,           label: 'Transport',        path: '/transport'  },
      { icon: Calendar,        label: 'Scheduling',       path: '/schedule'   },
      { icon: Recycle,         label: 'Waste Management', path: '/waste'      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { icon: Brain,     label: 'PineTrack Agent', path: '/admin/ai-insights' },
      { icon: BarChart3, label: 'Analytics',   path: '/analytics'         },
    ],
  },
  {
    label: 'Administration',
    items: [
      { icon: FileText, label: 'Reports',  path: '/admin/reports'  },
      { icon: Users,    label: 'Users',    path: '/admin/users'    },
      { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ],
  },
]

export default function AdminSidebar() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const user       = authService.getUser()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <aside
      className={`flex flex-col shrink-0 transition-all duration-300 h-full ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
      style={{ backgroundColor: '#162f25' }}
    >
      {/* Brand header */}
      <div
        className="flex items-center justify-between px-4 py-4 h-16"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="font-logo font-bold text-[1.15rem] leading-none tracking-tight">
              <span className="text-white">PINE</span><span style={{ color: '#f5922a' }}>TRACK v2</span>
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={9} style={{ color: '#8ac5a8' }} />
              <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#8ac5a8' }}>
                Admin Portal
              </p>
            </div>
          </div>
        ) : (
          <p className="font-logo font-bold text-base text-white mx-auto leading-none">P</p>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md transition-colors shrink-0 ml-1"
            style={{ color: '#56a880' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronLeft size={15} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute right-0 translate-x-1/2 p-1 rounded-full shadow border"
            style={{ backgroundColor: '#162f25', borderColor: 'rgba(255,255,255,0.1)', color: '#8ac5a8', top: '22px' }}
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-5">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            {!collapsed && (
              <p
                className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: '#4a7a5e' }}
              >
                {label}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map(({ icon: Icon, label: itemLabel, path }) => {
                const active = isActive(path)
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    title={collapsed ? itemLabel : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      collapsed ? 'justify-center' : ''
                    }`}
                    style={
                      active
                        ? { backgroundColor: 'rgba(212,129,58,0.18)', color: '#f7bf70' }
                        : { color: '#8ac5a8' }
                    }
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'
                        e.currentTarget.style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#8ac5a8'
                      }
                    }}
                  >
                    <Icon
                      size={17}
                      className="shrink-0"
                      style={active ? { color: '#f29b38' } : undefined}
                    />
                    {!collapsed && <span className="truncate">{itemLabel}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile + sign out */}
      <div
        className="px-2 pb-3 pt-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1e4535', border: '1px solid rgba(138,197,168,0.2)' }}
          >
            <UserCircle size={16} style={{ color: '#8ac5a8' }} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.full_name || user?.username}
              </p>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: '#4a7a5e' }}>
                Administrator
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{ color: '#f87171' }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.12)'
            e.currentTarget.style.color = '#fca5a5'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#f87171'
          }}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
