import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Calendar, CheckSquare, Layers, LogOut, Recycle, Sprout, Truck, UserCircle } from 'lucide-react'
import { authService } from '../../services/auth'

/** Worker tabs. `match` lists path prefixes that belong to the tab (detail pages included). */
const TABS = [
  { icon: CheckSquare, label: 'My Tasks',  path: '/my-tasks',         match: ['/my-tasks'] },
  { icon: Layers,      label: 'Sulur',     path: '/worker/sulur',     match: ['/worker/sulur', '/worker/sulur/'] },
  { icon: Sprout,      label: 'Harvest',   path: '/harvest-entry',    match: ['/harvest-entry', '/harvest/', '/my-records'] },
  { icon: Truck,       label: 'Transport', path: '/transport-update', match: ['/transport-update', '/transport/'] },
  { icon: Recycle,     label: 'Waste',     path: '/waste-submit',     match: ['/waste-submit'] },
  { icon: Calendar,    label: 'Schedule',  path: '/my-schedule',      match: ['/my-schedule'] },
]

function Brand({ dark }: { dark?: boolean }) {
  return (
    <p className="font-logo font-bold text-[1.05rem] leading-none tracking-tight">
      <span className={dark ? 'text-white' : 'text-green-900'}>PINE</span>
      <span className="text-[#e07d1c]">TRACK</span>
    </p>
  )
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'W'
}

/**
 * Below the xl breakpoint (phones and tablets, portrait and landscape): a slim
 * top bar with the profile link and a fixed bottom tab bar. From xl up: a
 * sidebar styled like the admin portal's.
 */
export default function WorkerNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = authService.getUser()
  const name = user?.full_name || user?.username || 'Worker'

  const isActive = (match: string[]) => match.some((m) => (m.endsWith('/') ? pathname.startsWith(m) : pathname === m))
  const onProfile = pathname === '/profile'

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <>
      {/* ── Wide screens: sidebar, matching the admin portal ───────────────── */}
      <aside className="hidden xl:flex sticky top-0 h-screen w-60 shrink-0 flex-col bg-[#162f25]">
        <div className="flex h-16 items-center px-5 border-b border-white/[0.07]">
          <div>
            <Brand dark />
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[#8ac5a8]">Worker</p>
          </div>
        </div>

        <nav aria-label="Main" className="flex-1 px-2 py-4 space-y-0.5">
          {TABS.map(({ icon: Icon, label, path, match }) => {
            const active = isActive(match)
            return (
              <Link key={path} to={path} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-[rgba(212,129,58,0.18)] text-[#f7bf70]' : 'text-[#8ac5a8] hover:bg-white/[0.06] hover:text-white'
                }`}>
                <Icon size={17} strokeWidth={1.75} className={active ? 'text-[#f29b38]' : ''} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-2 pt-3 pb-3 space-y-0.5 border-t border-white/[0.07]">
          <Link to="/profile" aria-current={onProfile ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
              onProfile ? 'bg-[rgba(212,129,58,0.18)]' : 'hover:bg-white/[0.06]'
            }`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e4535] text-xs font-semibold text-[#8ac5a8] border border-[#8ac5a8]/20">
              {initials(name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{name}</span>
              <span className="block text-[10px] uppercase tracking-wide text-[#8ac5a8]">Profile</span>
            </span>
          </Link>
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#8ac5a8] hover:bg-white/[0.06] hover:text-white transition-colors">
            <LogOut size={17} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Phones and tablets: top bar ────────────────────────────────────── */}
      <header className="xl:hidden sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/my-tasks" aria-label="PineTrack home"><Brand /></Link>
          <Link to="/profile" aria-label="Your profile" aria-current={onProfile ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-1 sm:pr-3 transition-colors ${onProfile ? 'bg-green-50' : 'hover:bg-gray-100'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              onProfile ? 'bg-green-700 text-white' : 'bg-green-50 text-green-800 ring-1 ring-green-200'
            }`}>
              {user ? initials(name) : <UserCircle size={18} />}
            </span>
            <span className="hidden sm:block max-w-[10rem] truncate text-sm font-medium text-gray-700">{name}</span>
          </Link>
        </div>
      </header>

      {/* ── Phones and tablets: bottom tab bar ─────────────────────────────── */}
      <nav aria-label="Main" data-bottom-nav
        className="xl:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-2px_12px_rgba(16,24,40,0.06)] pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-6 px-1">
          {TABS.map(({ icon: Icon, label, path, match }) => {
            const active = isActive(match)
            return (
              <li key={path}>
                <Link to={path} aria-current={active ? 'page' : undefined}
                  className="group flex min-h-[64px] flex-col items-center justify-center gap-1 px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 rounded-lg">
                  <span className={`flex h-8 w-14 max-w-full items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-green-100 text-green-800' : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-700'
                  }`}>
                    <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
                  </span>
                  <span className={`max-w-full truncate text-[11px] leading-none ${
                    active ? 'font-semibold text-green-800' : 'font-medium text-gray-500'
                  }`}>
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
