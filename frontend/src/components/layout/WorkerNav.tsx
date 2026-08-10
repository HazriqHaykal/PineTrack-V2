import { useNavigate, useLocation } from 'react-router-dom'
import { CheckSquare, Sprout, Truck, Recycle, Calendar, UserCircle, LogOut } from 'lucide-react'
import { authService } from '../../services/auth'

const TABS = [
  { icon: CheckSquare, label: 'My Tasks',  path: '/my-tasks'         },
  { icon: Sprout,      label: 'Harvest',   path: '/harvest-entry'    },
  { icon: Truck,       label: 'Transport', path: '/transport-update' },
  { icon: Recycle,     label: 'Waste',     path: '/waste-submit'     },
  { icon: Calendar,    label: 'Schedule',  path: '/my-schedule'      },
]

export default function WorkerNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const user     = authService.getUser()

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────── */}
      <aside className="hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0 w-52 min-h-screen">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 h-16">
          <span className="text-2xl">🍍</span>
          <div>
            <p className="font-bold text-sm text-gray-900 leading-tight">PineTrack</p>
            <p className="text-[9px] text-green-600 uppercase tracking-widest font-semibold">Worker</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(({ icon: Icon, label, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Profile */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive('/profile') ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
            }`}
          >
            <UserCircle size={20} />
            <div className="text-left min-w-0">
              <p className="font-semibold truncate text-xs">{user?.full_name || user?.username}</p>
              <p className="text-[10px] opacity-70 uppercase">Worker</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors mt-1"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar (hidden on desktop) ───────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex">
          {TABS.map(({ icon: Icon, label, path }) => {
            const active = isActive(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  active ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[10px] font-medium ${active ? 'text-green-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
