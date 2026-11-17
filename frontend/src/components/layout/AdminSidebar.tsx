import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, UserCircle, Shield } from 'lucide-react'
import { authService } from '../../services/auth'
import { ADMIN_NAV, NavGroup, NavLink, activeGroupId, allowed, isLinkActive } from './adminNav'

const OPEN_KEY = 'admin_nav_open_groups'

const C = {
  bg:          '#162f25',
  text:        '#8ac5a8',
  muted:       '#4a7a5e',
  activeBg:    'rgba(212,129,58,0.18)',
  activeText:  '#f7bf70',
  activeIcon:  '#f29b38',
  divider:     'rgba(255,255,255,0.07)',
}

// Session storage can be unavailable (private mode, blocked storage); the sidebar works without it
function readOpen(): string[] {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}
function writeOpen(ids: string[]) {
  try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(ids)) } catch { /* not persisted */ }
}

const rowBase = 'w-full flex items-center gap-3 rounded-lg font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f29b38]/70'

function ItemLink({ link, active, collapsed, nested }: { link: NavLink; active: boolean; collapsed: boolean; nested?: boolean }) {
  const Icon = link.icon
  return (
    <Link
      to={link.path}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? link.label : undefined}
      className={`${rowBase} ${nested ? 'px-3 py-2 text-[13px]' : 'px-3 py-2.5 text-sm'} ${collapsed ? 'justify-center' : ''} ${
        active ? '' : 'hover:bg-white/[0.06] hover:text-white'
      }`}
      style={active ? { backgroundColor: C.activeBg, color: C.activeText } : { color: C.text }}
    >
      <Icon size={nested ? 15 : 17} strokeWidth={1.75} className="shrink-0" style={active ? { color: C.activeIcon } : undefined} />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  )
}

function Group({ group, pathname, open, collapsed, onToggle }: {
  group: NavGroup
  pathname: string
  open: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const Icon = group.icon
  const containsActive = group.children.some((c) => isLinkActive(pathname, c))
  const listId = `admin-nav-${group.id}`
  const expanded = open && !collapsed

  return (
    <div>
      {/* Toggles only; never navigates */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
        title={collapsed ? group.label : undefined}
        className={`${rowBase} px-3 py-2.5 text-sm hover:bg-white/[0.06] ${collapsed ? 'justify-center' : ''}`}
        style={{ color: containsActive ? '#ffffff' : C.text }}
      >
        <Icon size={17} strokeWidth={1.75} className="shrink-0" style={containsActive ? { color: C.activeIcon } : undefined} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left leading-snug">{group.label}</span>
            <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </>
        )}
      </button>

      <ul
        id={listId}
        hidden={!expanded}
        aria-label={group.label}
        className="mt-0.5 ml-[18px] pl-2.5 space-y-0.5 border-l"
        style={{ borderColor: 'rgba(138,197,168,0.18)' }}
      >
        {group.children.map((child) => (
          <li key={child.path}>
            <ItemLink link={child} active={isLinkActive(pathname, child)} collapsed={false} nested />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = authService.getUser()
  const role = user?.role
  // Start as the icon rail on narrow screens so the page keeps most of the width
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.matchMedia('(max-width: 1023px)').matches } catch { return false }
  })

  // Groups the user opened this session, plus the one holding the current page
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const active = activeGroupId(pathname)
    const saved = readOpen()
    return active && !saved.includes(active) ? [...saved, active] : saved
  })

  // Navigating into a group (link, refresh, back/forward) opens it; other groups keep their state
  useEffect(() => {
    const active = activeGroupId(pathname)
    if (active) {
      setOpenGroups((prev) => {
        if (prev.includes(active)) return prev
        const next = [...prev, active]
        writeOpen(next)
        return next
      })
    }
  }, [pathname])

  const toggleGroup = (id: string) => {
    if (collapsed) {
      // In the icon rail, a group header opens the full sidebar with that group expanded
      setCollapsed(false)
      setOpenGroups((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id]
        writeOpen(next)
        return next
      })
      return
    }
    setOpenGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
      writeOpen(next)
      return next
    })
  }

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const sections = ADMIN_NAV
    .map((s) => ({ ...s, entries: s.entries.filter((e) => allowed(e.roles, role)) }))
    .filter((s) => s.entries.length > 0)

  return (
    <aside
      className={`relative flex flex-col shrink-0 transition-all duration-300 h-full ${collapsed ? 'w-[68px]' : 'w-64'}`}
      style={{ backgroundColor: C.bg }}
    >
      <div className="flex items-center justify-between px-4 py-4 h-16" style={{ borderBottom: `1px solid ${C.divider}` }}>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="font-logo font-bold text-[1.15rem] leading-none tracking-tight">
              <span className="text-white">PINE</span><span style={{ color: '#f5922a' }}>TRACK v2</span>
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={9} style={{ color: C.text }} />
              <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: C.text }}>
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
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md transition-colors shrink-0 ml-1 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f29b38]/70"
            style={{ color: '#56a880' }}
          >
            <ChevronLeft size={15} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="absolute right-0 translate-x-1/2 p-1 rounded-full shadow border z-10"
            style={{ backgroundColor: C.bg, borderColor: 'rgba(255,255,255,0.1)', color: C.text, top: '22px' }}
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      <nav aria-label="Admin" className="flex-1 px-2 py-4 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.label} role="group" aria-label={section.label}>
            {collapsed ? (
              <div className="mx-3 mb-2 h-px" style={{ backgroundColor: C.divider }} aria-hidden />
            ) : (
              <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.entries.map((entry) =>
                entry.kind === 'group' ? (
                  <Group
                    key={entry.id}
                    group={entry}
                    pathname={pathname}
                    open={openGroups.includes(entry.id)}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(entry.id)}
                  />
                ) : (
                  <ItemLink key={entry.path} link={entry} active={isLinkActive(pathname, entry)} collapsed={collapsed} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 pb-3 pt-3 space-y-0.5" style={{ borderTop: `1px solid ${C.divider}` }} role="group" aria-label="Account">
        {!collapsed && (
          <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: C.muted }}>Account</p>
        )}
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1e4535', border: '1px solid rgba(138,197,168,0.2)' }}
          >
            <UserCircle size={16} style={{ color: C.text }} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.full_name || user?.username}
              </p>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: C.muted }}>
                Administrator
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={`${rowBase} px-3 py-2 text-xs hover:bg-white/[0.06] ${collapsed ? 'justify-center' : ''}`}
          style={{ color: '#f87171' }}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
