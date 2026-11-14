import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
<<<<<<< HEAD
  LayoutDashboard, Sprout, Truck, Calendar, Recycle,
  Lightbulb, BarChart3, Calculator, FileText, Users, Settings,
  ChevronLeft, ChevronRight, LogOut, UserCircle, Shield,
=======
  LayoutDashboard, Sprout, Layers, Truck, Calendar, Recycle,
  Brain, BarChart3, FileText, Users, Settings,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, UserCircle, Shield,
  Package, ArrowRightLeft, Calculator
>>>>>>> origin/arif-sulur-module
} from 'lucide-react'
import { authService } from '../../services/auth'

const SULUR_CHILDREN = [
  { icon: Package,        label: '1. Stock & Batches',   path: '/admin/sulur/stock'     },
  { icon: ArrowRightLeft, label: '2. Movement History',  path: '/admin/sulur/movements' },
  { icon: Calculator,     label: '3. Profit Calculator', path: '/admin/sulur/planner'   },
]

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard'   },
      { icon: Layers,          label: 'Sulur Inventory',  path: '/admin/sulur', isSulurParent: true },
      { icon: Sprout,          label: 'Harvest',          path: '/harvest'     },
      { icon: Truck,           label: 'Transport',        path: '/transport'   },
      { icon: Calendar,        label: 'Scheduling',       path: '/schedule'    },
      { icon: Recycle,         label: 'Waste Management', path: '/waste'       },
    ],
  },
  {
    label: 'Intelligence',
    items: [
<<<<<<< HEAD
      { icon: Lightbulb, label: 'PineTrack Agent', path: '/admin/ai-insights' },
      { icon: BarChart3, label: 'Analytics',   path: '/analytics'         },
      { icon: Calculator, label: 'Harvest & Profit Planner', path: '/profit-planner' },
=======
      { icon: Brain,     label: 'PineTrack Agent', path: '/admin/ai-insights' },
      { icon: BarChart3, label: 'Analytics',       path: '/analytics'         },
>>>>>>> origin/arif-sulur-module
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

  const onSulurRoute = location.pathname.startsWith('/admin/sulur') || location.pathname.startsWith('/sulur')
  const [sulurOpen, setSulurOpen] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('sulur_nav_open')
    if (saved !== null) return saved === 'true' && onSulurRoute
    return onSulurRoute
  })

  useEffect(() => {
    if (!onSulurRoute) {
      setSulurOpen(false)
      sessionStorage.setItem('sulur_nav_open', 'false')
    }
  }, [onSulurRoute])

  const toggleSulurMenu = () => {
    if (!onSulurRoute) {
      setSulurOpen(true)
      sessionStorage.setItem('sulur_nav_open', 'true')
      navigate('/admin/sulur/stock')
    } else {
      const next = !sulurOpen
      setSulurOpen(next)
      sessionStorage.setItem('sulur_nav_open', String(next))
    }
  }

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
              {items.map(({ icon: Icon, label: itemLabel, path, isSulurParent }: any) => {
                const active = isActive(path)
                if (isSulurParent) {
                  return (
                    <div key={path} className="space-y-1">
                      <button
                        onClick={toggleSulurMenu}
                        title={collapsed ? itemLabel : undefined}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                          collapsed ? 'justify-center' : ''
                        }`}
                        style={
                          active
                            ? { backgroundColor: 'rgba(212,129,58,0.18)', color: '#f7bf70' }
                            : { color: '#8ac5a8' }
                        }
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={17} className="shrink-0" style={active ? { color: '#f29b38' } : undefined} />
                          {!collapsed && <span className="truncate">{itemLabel}</span>}
                        </div>
                        {!collapsed && (
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${sulurOpen ? 'rotate-180' : ''}`}
                          />
                        )}
                      </button>

                      {!collapsed && sulurOpen && (
                        <div className="ml-4 pl-3 border-l border-emerald-800/70 space-y-1 py-1">
                          {SULUR_CHILDREN.map(child => {
                            const ChildIcon = child.icon
                            const childActive =
                              location.pathname === child.path ||
                              (child.path === '/admin/sulur/stock' && location.pathname === '/admin/sulur')
                            return (
                              <button
                                key={child.path}
                                onClick={() => navigate(child.path)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                                style={
                                  childActive
                                    ? { backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', fontWeight: 600 }
                                    : { color: '#8ac5a8' }
                                }
                              >
                                <ChildIcon size={14} className="shrink-0" style={childActive ? { color: '#f5922a' } : undefined} />
                                <span className="truncate">{child.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <button
                    key={path}
                    onClick={() => {
                      setSulurOpen(false)
                      sessionStorage.setItem('sulur_nav_open', 'false')
                      navigate(path)
                    }}
                    title={collapsed ? itemLabel : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      collapsed ? 'justify-center' : ''
                    }`}
                    style={
                      active
                        ? { backgroundColor: 'rgba(212,129,58,0.18)', color: '#f7bf70' }
                        : { color: '#8ac5a8' }
                    }
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
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
