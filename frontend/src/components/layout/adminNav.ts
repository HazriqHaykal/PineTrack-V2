import {
  LayoutDashboard, Sprout, Truck, Calendar, Recycle, Calculator,
  Layers, Package, ArrowRightLeft, Warehouse,
  Lightbulb, BarChart3, FileText, Users, Settings,
  type LucideIcon,
} from 'lucide-react'

import { tr } from '../../i18n'
/**
 * Admin Portal navigation. Routes are the existing ones; the hierarchy here is
 * presentation only. Visibility is a convenience: every page is still guarded
 * by AdminRoute in App.tsx and every API call is authorised on the backend.
 */

export type Role = 'admin' | 'worker'

export interface NavLink {
  label: string
  icon: LucideIcon
  path: string
  /** Extra paths that count as this page when matched exactly (e.g. a module's index URL) */
  alsoActiveOn?: string[]
  roles?: Role[]
}

export interface NavGroup {
  /** Stable id, used for the expanded state and element ids */
  id: string
  label: string
  icon: LucideIcon
  children: NavLink[]
  roles?: Role[]
}

export type NavEntry = ({ kind: 'link' } & NavLink) | ({ kind: 'group' } & NavGroup)

export interface NavSection {
  /** Heading above the entries; omitted for the top-level Dashboard link */
  label?: string
  entries: NavEntry[]
}

export const ADMIN_NAV: NavSection[] = [
  {
    // Farm-wide overview of both modules, so it sits outside either module group
    entries: [
      { kind: 'link', label: tr("Dashboard"), icon: LayoutDashboard, path: '/dashboard', roles: ['admin'] },
    ],
  },
  {
    label: tr("Operations"),
    entries: [
      {
        kind: 'group',
        id: 'sulur',
        label: tr("Sulur Inventory"),
        icon: Layers,
        roles: ['admin'],
        children: [
          { label: tr("Stock & Batches"),   icon: Package,        path: '/admin/sulur/stock', alsoActiveOn: ['/admin/sulur'] },
          { label: tr("Movement History"),  icon: ArrowRightLeft, path: '/admin/sulur/movements' },
          { label: tr("Profit Calculator"), icon: Calculator,     path: '/admin/sulur/planner' },
        ],
      },
      {
        kind: 'group',
        id: 'post-harvest',
        label: tr("Post-Harvest Management"),
        icon: Warehouse,
        roles: ['admin'],
        children: [
          { label: tr("Harvest"),                  icon: Sprout,          path: '/harvest' },
          { label: tr("Transport"),                icon: Truck,           path: '/transport' },
          { label: tr("Scheduling"),               icon: Calendar,        path: '/schedule' },
          { label: tr("Waste Management"),         icon: Recycle,         path: '/waste' },
          { label: tr("Harvest & Profit Planner"), icon: Calculator,      path: '/profit-planner' },
        ],
      },
    ],
  },
  {
    label: tr("Shared Intelligence"),
    entries: [
      { kind: 'link', label: tr("PineTrack Agent"), icon: Lightbulb, path: '/admin/ai-insights', roles: ['admin'] },
      { kind: 'link', label: tr("Analytics"),       icon: BarChart3, path: '/analytics',         roles: ['admin'] },
    ],
  },
  {
    label: tr("Administration"),
    entries: [
      { kind: 'link', label: tr("Reports"),  icon: FileText, path: '/admin/reports',  roles: ['admin'] },
      { kind: 'link', label: tr("Users"),    icon: Users,    path: '/admin/users',    roles: ['admin'] },
      { kind: 'link', label: tr("Settings"), icon: Settings, path: '/admin/settings', roles: ['admin'] },
    ],
  },
]

/** A page is active on its own path and anything below it (detail pages), or on an exact alias */
export function isLinkActive(pathname: string, link: NavLink): boolean {
  return pathname === link.path
    || pathname.startsWith(link.path + '/')
    || (link.alsoActiveOn ?? []).includes(pathname)
}

export function activeGroupId(pathname: string, sections: NavSection[] = ADMIN_NAV): string | null {
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.kind === 'group' && entry.children.some((c) => isLinkActive(pathname, c))) return entry.id
    }
  }
  return null
}

export function allowed(roles: Role[] | undefined, role: string | undefined): boolean {
  return !roles || (!!role && roles.includes(role as Role))
}
