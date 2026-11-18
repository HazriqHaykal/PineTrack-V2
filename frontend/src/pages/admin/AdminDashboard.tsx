import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Hourglass, Info,
  Navigation, Package, Recycle, RefreshCw, ShieldCheck, Sprout, Truck, XCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import GradeBadge, { GRADES, GRADE_HEX, isMixed, normalizeGrade } from '../../components/batch/GradeBadge'
import { apiClient, apiErrorMessage } from '../../services/api'
import { authService } from '../../services/auth'
import { MODULE_META, ModuleKey } from '../../components/ui/ModuleScope'
import { AnalyticsOverview, HarvestStats, SulurAnalytics, TransportEfficiency, WasteStats } from '../../types'

import { tr, locale } from '../../i18n'
// PineTrack brand, matching the sidebar
const BRAND_DARK  = '#162f25'
const BRAND_GREEN = '#2d6a4f'
const BRAND_SAGE  = '#8ac5a8'
const BRAND_ORANGE = '#f5922a'

const FARM_TIMEZONE = 'Asia/Kuala_Lumpur'
const FALLBACK_FARM_NAME = 'Seri Nenas Farm'
// What the Settings API returns when no farm name has been saved
const UNCONFIGURED_FARM_NAME = 'PineTrack Farm'

const ICON = { size: 16, strokeWidth: 1.75 } as const
const AXIS_TICK = { fontSize: 11, fill: '#6b7280' }
const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)' }

const kg = (n: number) => `${Math.round(n).toLocaleString()} kg`
const dayFmt = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── Shared building blocks ───────────────────────────────────────────────────

function Panel({ title, subtitle, action, children, className = '', flush }: {
  title: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string
  /** Let the body run edge to edge (tables) */
  flush?: boolean
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`flex-1 min-h-0 ${flush ? '' : 'px-5 pb-5'}`}>{children}</div>
    </section>
  )
}

function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(to)}
      className="inline-flex items-center gap-0.5 text-xs font-medium text-green-800 hover:text-green-900 hover:underline whitespace-nowrap">
      {children} <ChevronRight size={14} strokeWidth={1.75} />
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-gray-500">{text}</div>
}

// ── Welcome banner ───────────────────────────────────────────────────────────

function farmGreeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: FARM_TIMEZONE }).format(now))
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const date = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FARM_TIMEZONE })
  return { part, date }
}

/** Faint pineapple crown and field rows, drawn behind the banner text */
function BannerDecoration() {
  return (
    <svg
      className="absolute right-0 top-0 h-full w-72 opacity-[0.12] pointer-events-none hidden sm:block"
      viewBox="0 0 288 160" fill="none" aria-hidden
    >
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
        <path d="M214 120 C204 86 186 62 160 46" />
        <path d="M222 118 C220 80 214 46 200 18" />
        <path d="M230 118 C238 84 250 56 270 38" />
        <path d="M218 120 C200 100 178 92 150 92" />
        <path d="M234 120 C252 102 268 96 288 98" />
      </g>
      <g fill={BRAND_ORANGE}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle key={i} cx={40 + i * 26} cy={146} r="3" />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={53 + i * 26} cy={134} r="2.5" />
        ))}
      </g>
    </svg>
  )
}

function WelcomeBanner({ name, farmName }: { name: string; farmName: string | null }) {
  const { part, date } = farmGreeting(new Date())
  return (
    <section
      className="relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-sm"
      style={{ background: `linear-gradient(120deg, ${BRAND_DARK} 0%, ${BRAND_GREEN} 100%)` }}
    >
      <BannerDecoration />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND_SAGE }}>{date}</p>
        <h1 className="text-2xl font-bold mt-1">{tr(part === 'morning' ? 'Good morning, {0}' : part === 'afternoon' ? 'Good afternoon, {0}' : 'Good evening, {0}', name)}</h1>
        <p className="text-sm mt-1" style={{ color: '#d6eadf' }}>
          {tr("Welcome to")}{' '}
          <span className="font-semibold" style={{ color: '#f7bf70' }}>{farmName ?? '…'}</span>.
          {' '}{tr("Here is what is happening at your farm today.")}
        </p>
      </div>
    </section>
  )
}

// ── Module sections ──────────────────────────────────────────────────────────

/** Module icons and accents are shared with Analytics and Reports */
const MODULE = MODULE_META

function ModuleSection({ module, subtitle, link, linkLabel, children, footer }: {
  module: ModuleKey; subtitle: string; link: string; linkLabel: string; children: React.ReactNode; footer?: React.ReactNode
}) {
  const m = MODULE[module]
  const Icon = m.icon
  return (
    <section aria-label={m.label} className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-w-0">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.tile}`}>
            <Icon {...ICON} size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{m.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <PanelLink to={link}>{linkLabel}</PanelLink>
      </div>
      <div className="flex-1 px-5 pb-5">{children}</div>
      {footer && <div className="border-t border-gray-100 px-5 py-3">{footer}</div>}
    </section>
  )
}

/** One figure inside a module section; the period says which time window the number covers */
function MetricTile({ label, period, value, sub, progress, warn, onClick }: {
  label: string; period: string; value: string; sub: string
  /** 0–100: draws a thin progress bar under the value */
  progress?: number
  warn?: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`group text-left rounded-lg border px-3.5 py-3 h-full flex flex-col transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
        warn ? 'border-amber-200 bg-amber-50/60 hover:border-amber-300' : 'border-gray-100 bg-gray-50/60 hover:border-gray-300'
      }`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 truncate">{label}</span>
        <span className="text-[11px] text-gray-500 whitespace-nowrap">{period}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 leading-tight mt-1.5 tabular-nums truncate">{value}</p>
      {progress != null && (
        <div className="mt-2 h-1.5 rounded-full bg-gray-200" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: BRAND_GREEN }} />
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1.5 truncate">{sub}</p>
    </button>
  )
}

function SectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle {...ICON} className="shrink-0" />
      <span className="flex-1 min-w-0">{text}</span>
      <button onClick={onRetry} className="flex items-center gap-1.5 font-medium hover:underline">
        <RefreshCw {...ICON} size={14} /> {tr("Try again")}
      </button>
    </div>
  )
}

function TileSkeletons() {
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-lg bg-gray-100" />)}
    </div>
  )
}

const pcs = (n: number) => tr("{0} pcs", n.toLocaleString())

function SulurOverview({ data, error, onRetry }: { data: SulurAnalytics | null; error: string; onRetry: () => void }) {
  const navigate = useNavigate()
  const toStock = () => navigate('/admin/sulur/stock')
  let body: React.ReactNode
  if (error) body = <SectionError text={error} onRetry={onRetry} />
  else if (!data) body = <TileSkeletons />
  else if (!data.has_data) body = <EmptyState text={tr("No Sulur batches recorded yet. Figures appear once batches are added.")} />
  else {
    const { totals, alerts } = data
    const below = alerts.below_threshold
    const alertCount = below + (alerts.aging_batches ? 1 : 0) + (alerts.uncertified_batches ? 1 : 0)
    body = (
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <MetricTile label={tr("Available Sulur")} period={tr("Current stock")} value={pcs(totals.available)}
          sub={tr("{0} batches · {1} varieties", data.batches, data.by_variety.length)} onClick={toStock} />
        <MetricTile label={tr("Planted & Reserved")} period={tr("Current stock")} value={pcs(totals.planted + totals.reserved)}
          sub={tr("{0} planted · {1} reserved", totals.planted.toLocaleString(), totals.reserved.toLocaleString())}
          onClick={() => navigate('/admin/sulur/movements')} />
        <MetricTile label={tr("Certified Batches")} period={tr("Current")} value={`${data.certified_batches} / ${data.batches}`}
          progress={data.batches ? (data.certified_batches / data.batches) * 100 : 0}
          sub={tr("{0} with stock awaiting certification", alerts.uncertified_batches)} onClick={toStock} />
        <MetricTile label={tr("Stock Alerts")} period={tr("Now")} value={String(alertCount)} warn={alertCount > 0}
          sub={tr("{0} below minimum · {1} aging · {2} uncertified", below, alerts.aging_batches, alerts.uncertified_batches)}
          onClick={toStock} />
      </div>
    )
  }
  return (
    <ModuleSection module="sulur" subtitle={tr("Planting material in the nursery · counts in sulur pieces")}
      link="/admin/sulur/stock" linkLabel={tr("Stock & Batches")}>
      {body}
    </ModuleSection>
  )
}

/** Each opens the module's existing form through its ?new=1 hook; no forms are duplicated here */
const QUICK_ACTIONS = [
  { label: tr("New Harvest"),   path: '/harvest?new=1',   icon: Sprout },
  { label: tr("New Transport"), path: '/transport?new=1', icon: Truck },
  { label: tr("Assign Task"),   path: '/schedule?new=1',  icon: CalendarPlus },
  { label: tr("Log Waste"),     path: '/waste?new=1',     icon: Recycle },
]

function QuickActions() {
  const navigate = useNavigate()
  // The dashboard is admin-only, and every action opens an admin form
  if (!authService.isAdmin()) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500 mr-1">{tr("Quick actions")}</span>
      {QUICK_ACTIONS.map(({ label, path, icon: Icon }) => (
        <button key={label} onClick={() => navigate(path)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-800 hover:border-green-700 hover:bg-green-50/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
          <Icon {...ICON} size={14} className="shrink-0 text-green-800" />
          {label}
        </button>
      ))}
    </div>
  )
}

function PostHarvestOverview({ hStats, tStats, wStats, overview, error, onRetry }: {
  hStats: HarvestStats | null; tStats: TransportEfficiency | null; wStats: WasteStats | null; overview: AnalyticsOverview | null
  error: string; onRetry: () => void
}) {
  const navigate = useNavigate()
  let body: React.ReactNode
  if (error) body = <SectionError text={error} onRetry={onRetry} />
  else if (!hStats || !tStats || !wStats || !overview) body = <TileSkeletons />
  else {
    const cur = overview.kpis.current
    const days = overview.kpis.period_days
    body = (
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <MetricTile label={tr("Total Harvested")} period={tr("All time")} value={kg(hStats.total_quantity_kg)}
          sub={tr("{0} batches · {1} in last {2} days", hStats.total_harvests, kg(cur.harvest_volume_kg), days)}
          onClick={() => navigate('/harvest')} />
        <MetricTile label={tr("Marketable Yield")} period={tr("Last {0} days", days)}
          value={cur.marketable_yield_percent != null ? `${cur.marketable_yield_percent}%` : '—'}
          sub={cur.graded_batches
            ? tr("{0} marketable · {1} graded batches", kg(cur.marketable_kg), cur.graded_batches)
            : tr("No graded batches in this period")}
          onClick={() => navigate('/harvest')} />
        <MetricTile label={tr("Delivery Progress")} period={tr("All time")} value={`${tStats.delivered} / ${tStats.total_transports}`}
          progress={tStats.total_transports ? (tStats.delivered / tStats.total_transports) * 100 : 0}
          sub={tr("{0} in transit · {1} scheduled", tStats.in_transit, tStats.pending)}
          onClick={() => navigate('/transport')} />
        <MetricTile label={tr("Waste Recorded")} period={tr("All time")} value={kg(wStats.total_waste_kg)}
          sub={tr("{0} records · {1} in last {2} days", wStats.total_records, kg(cur.waste_kg), days)}
          onClick={() => navigate('/waste')} />
      </div>
    )
  }
  return (
    <ModuleSection module="post_harvest" subtitle={tr("Harvest, delivery and waste · weights in kg")}
      link="/harvest" linkLabel={tr("Harvest")} footer={<QuickActions />}>
      {body}
    </ModuleSection>
  )
}

// ── Needs your attention (both modules) ──────────────────────────────────────

type Alert = AnalyticsOverview['alerts'][number]
type Priority = 'high' | 'medium' | 'low'

interface UnifiedAlert {
  key: string
  module: ModuleKey
  priority: Priority
  msg: string
  icon: React.ElementType
  link: string | null
  linkLabel: string
  rank: number
}

const PRIORITY: Record<Priority, { label: string; badge: string; bar: string; icon: string; order: number }> = {
  high:   { label: tr("High priority"),   badge: 'bg-red-50 text-red-800 ring-red-200',       bar: 'bg-red-500',   icon: 'text-red-600',   order: 0 },
  medium: { label: tr("Medium priority"), badge: 'bg-amber-50 text-amber-800 ring-amber-200', bar: 'bg-amber-500', icon: 'text-amber-600', order: 1 },
  low:    { label: tr("Low priority"),    badge: 'bg-blue-50 text-blue-800 ring-blue-200',    bar: 'bg-blue-400',  icon: 'text-blue-600',  order: 2 },
}

/**
 * Icon, rank and destination for each alert the backend raises. The link is the
 * backend's own, narrowed to a filtered list only where the filter means exactly
 * the same thing as the alert.
 */
function describeAlert(a: Alert): { icon: React.ElementType; rank: number; link: string | null; linkLabel: string } {
  const msg = a.msg.toLowerCase()
  const module = (link: string | null) =>
    ({ '/transport': tr("Transport"), '/schedule': tr("Scheduling"), '/harvest': tr("Harvest"), '/waste': tr("Waste") } as Record<string, string>)[link ?? ''] ?? tr("Open")
  const base = { link: a.link, linkLabel: module(a.link) }
  if (a.level === 'warning') {
    if (msg.includes('past their scheduled')) return { ...base, icon: Truck, rank: 0 }
    if (msg.includes('overdue'))              return { ...base, icon: CalendarClock, rank: 1 }
    if (msg.includes('spoilage'))             return { ...base, icon: AlertTriangle, rank: 2 }
    if (msg.includes('rejection'))            return { ...base, icon: XCircle, rank: 3 }
    return { ...base, icon: AlertTriangle, rank: 4 }
  }
  if (a.level === 'info') {
    if (msg.includes('graded'))     return { ...base, icon: ClipboardCheck, rank: 10 }
    if (msg.includes('in transit')) return { icon: Navigation, rank: 11, link: '/transport?status=in_transit', linkLabel: tr("View in transit") }
    return { ...base, icon: Info, rank: 12 }
  }
  return { ...base, icon: CheckCircle2, rank: 20 }
}

/** Post-harvest alerts as the backend raises them; "all clear" notes are left out of the combined list */
function postHarvestAlerts(alerts: Alert[]): UnifiedAlert[] {
  return alerts
    .filter((a) => a.level !== 'success')
    .map((a) => ({
      key: `ph-${a.msg}`,
      module: 'post_harvest' as const,
      priority: (a.level === 'warning' ? 'high' : 'low') as Priority,
      msg: a.msg,
      ...describeAlert(a),
    }))
}

/** Sulur alerts from /analytics/sulur, with the same priorities as the Sulur module's own alert rules */
function sulurAlerts(s: SulurAnalytics): UnifiedAlert[] {
  if (!s.has_data) return []
  const stock = { module: 'sulur' as const, link: '/admin/sulur/stock', linkLabel: tr("Stock & Batches") }
  const out: UnifiedAlert[] = s.by_variety.filter((v) => v.below_threshold).map((v) => {
    const empty = v.available === 0
    return {
      ...stock,
      key: `sulur-low-${v.variety}`,
      priority: empty ? 'high' : 'medium',
      icon: Package,
      rank: empty ? 0 : 5,
      msg: empty
        ? tr("{0} sulur stock is used up (minimum {1} pcs).", v.variety, v.min_stock_threshold.toLocaleString())
        : tr("{0} sulur stock is below minimum: {1} of {2} pcs available.", v.variety, v.available.toLocaleString(), v.min_stock_threshold.toLocaleString()),
    }
  })
  if (s.alerts.aging_batches) {
    out.push({ ...stock, key: 'sulur-aging', priority: 'medium', icon: Hourglass, rank: 6,
      msg: tr("{0} sulur batch(es) raw or curing for over 14 days.", s.alerts.aging_batches) })
  }
  if (s.alerts.uncertified_batches) {
    out.push({ ...stock, key: 'sulur-uncertified', priority: 'low', icon: ShieldCheck, rank: 10,
      msg: tr("{0} sulur batch(es) with stock awaiting quality certification.", s.alerts.uncertified_batches) })
  }
  return out
}

const badge = 'inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset'

function NeedsAttention({ alerts, loading, unavailable }: {
  alerts: UnifiedAlert[]
  loading: boolean
  /** Modules whose alerts could not be loaded */
  unavailable: ModuleKey[]
}) {
  const navigate = useNavigate()
  const sorted = [...alerts].sort((x, y) => PRIORITY[x.priority].order - PRIORITY[y.priority].order || x.rank - y.rank)
  const high = alerts.filter((a) => a.priority === 'high').length

  return (
    <Panel
      title={tr("Needs Your Attention")}
      subtitle={tr("Alerts from Sulur Inventory and Post-Harvest Management, highest priority first")}
      action={high > 0 && (
        <span className={`${badge} ${PRIORITY.high.badge}`}>{tr("{0} high priority", high)}</span>
      )}
      flush
    >
      {unavailable.length > 0 && (
        <p className="mx-5 mb-3 text-xs text-red-700">
          {tr("Alerts unavailable for: {0}. See the error above.", unavailable.map((m) => MODULE[m].label).join(', '))}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 px-5 pb-5">
          {loading ? tr("Checking both modules…") : tr("No alerts right now. Both modules are on track.")}
        </p>
      ) : (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {sorted.map(({ key, icon: Icon, link, linkLabel, module, priority, msg }) => {
            const p = PRIORITY[priority]
            const body = (
              <>
                <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${p.bar}`} aria-hidden />
                <Icon {...ICON} className={`shrink-0 ${p.icon}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 leading-snug">{msg}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className={`${badge} ${MODULE[module].badge}`}>{MODULE[module].label}</span>
                    <span className={`${badge} ${p.badge}`}>{p.label}</span>
                  </div>
                </div>
                {link && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 group-hover:text-green-800 whitespace-nowrap">
                    {linkLabel} <ChevronRight size={14} strokeWidth={1.75} />
                  </span>
                )}
              </>
            )
            return (
              <li key={key}>
                {link ? (
                  <button onClick={() => navigate(link)}
                    className="group relative flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50">
                    {body}
                  </button>
                ) : (
                  <div className="relative flex items-center gap-3 px-5 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ── Charts ───────────────────────────────────────────────────────────────────

function HarvestVolume({ trend }: { trend: AnalyticsOverview['harvest_trend'] }) {
  // One entry per month, oldest first, ending with the current month (zero months included)
  const data = trend.map((m, i) => ({ ...m, current: i === trend.length - 1 }))
  const hasData = data.some((m) => m.kg > 0)
  const total = data.reduce((s, m) => s + m.kg, 0)

  return (
    <Panel
      className="xl:col-span-2"
      title={tr("Harvest Volume")}
      subtitle={tr("Kilograms harvested per month, last {0} months · {1} in total", trend.length, kg(total))}
      action={<PanelLink to="/analytics">{tr("Analytics")}</PanelLink>}
    >
      {!hasData ? (
        <EmptyState text={tr("No harvests recorded in the last {0} months.", trend.length)} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK}
                tickFormatter={(m: string, i: number) => (data[i]?.current ? `${m}*` : m)} />
              <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={52}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(v))} />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(m: string) => (data.find((d) => d.month === m)?.current ? tr("{0} (month in progress)", m) : m)}
                formatter={(v: number, _n, item) => [
                  tr("{0} kg from {1} batch{2}", v.toLocaleString(), item.payload.batches, item.payload.batches === 1 ? '' : 'es'),
                  tr("Harvested"),
                ]}
              />
              <Bar dataKey="kg" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {data.map((m) => <Cell key={m.month} fill={m.current ? BRAND_SAGE : BRAND_GREEN} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_GREEN }} />{tr("Full month")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_SAGE }} />{tr("* Current month, still in progress")}</span>
          </div>
        </>
      )}
    </Panel>
  )
}

function GradeSplit({ grades }: { grades: AnalyticsOverview['grade_distribution'] }) {
  // The API groups raw grade text; fold spelling variants ("a", "Grade A") into one slice per grade
  const counts: Record<string, number> = {}
  grades.forEach((g) => {
    const k = normalizeGrade(g.grade) ?? (isMixed(g.grade) ? 'mixed' : 'ungraded')
    counts[k] = (counts[k] ?? 0) + g.count
  })
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const data = [...GRADES, 'mixed' as const, 'ungraded' as const]
    .filter((k) => counts[k])
    .map((k) => ({
      key: k,
      name: k === 'ungraded' ? tr("Ungraded") : k === 'mixed' ? tr("Mixed grades") : tr("Grade {0}", k),
      value: counts[k],
      percent: Math.round((counts[k] / total) * 1000) / 10,
      fill: k === 'mixed' ? '#64748b' : GRADE_HEX[k],
    }))

  return (
    <Panel title={tr("Quality Grade Split")} subtitle={tr("Batches harvested in the last 6 months, by overall grade. Grade weights are on Analytics.")}>
      {total === 0 ? (
        <EmptyState text={tr("No batches harvested in this period.")} />
      ) : (
        <div className="flex flex-col sm:flex-row xl:flex-col items-center gap-4">
          <div className="relative h-[150px] w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                  {data.map((d) => <Cell key={d.key} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, item) => [`${v} batch${v === 1 ? '' : 'es'} (${item.payload.percent}%)`, item.payload.name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-900 tabular-nums">{total}</span>
              <span className="text-[11px] text-gray-500">{tr("batches")}</span>
            </div>
          </div>
          <ul className="w-full space-y-1.5">
            {data.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-gray-700">{d.name}</span>
                <span className="ml-auto font-semibold text-gray-900 tabular-nums">{d.value}</span>
                <span className="w-12 text-right text-xs text-gray-500 tabular-nums">{d.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

function RecentHarvests({ rows }: { rows: AnalyticsOverview['recent_harvests'] }) {
  const navigate = useNavigate()
  return (
    <Panel
      className="xl:col-span-2"
      title={tr("Recent Harvest Activity")}
      subtitle={tr("Latest 5 batches. Select a row to open the batch.")}
      action={<PanelLink to="/harvest">{tr("All batches")}</PanelLink>}
      flush
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">{tr("No harvests recorded yet.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50">
                {[[tr("Batch"), ''], [tr("Field"), ''], [tr("Harvest date"), ''], [tr("Quantity"), 'text-right'], [tr("Grade"), ''], [tr("Recorded by"), '']].map(([h, cls]) => (
                  <th key={h} className={`text-left px-4 py-2.5 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} tabIndex={0} role="link" aria-label={tr("Open batch {0}", r.batch_number)}
                  onClick={() => navigate(`/harvest/${r.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/harvest/${r.id}`) }}
                  className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50/70 focus:outline-none focus-visible:bg-green-50/60 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-gray-900 whitespace-nowrap tabular-nums">{r.batch_number}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate" title={r.field}>{r.field}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap tabular-nums">{dayFmt(r.date)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">{kg(r.kg)}</td>
                  <td className="px-4 py-2.5"><GradeBadge grade={r.grade} /></td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{r.worker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function WorkerPerformance({ workers, since }: { workers: AnalyticsOverview['worker_performance']; since: string }) {
  const max = Math.max(1, ...workers.map((w) => w.tasks))
  return (
    <Panel
      title={tr("Worker Performance")}
      subtitle={tr("Tasks scheduled since {0}, excluding cancelled · top {1}", since, workers.length || 8)}
      action={<PanelLink to="/schedule">{tr("Scheduling")}</PanelLink>}
    >
      {workers.length === 0 ? (
        <EmptyState text={tr("No tasks assigned in this period.")} />
      ) : (
        <>
          <ul className="space-y-3">
            {workers.map((w) => {
              const pct = w.tasks ? Math.round((w.completed / w.tasks) * 100) : 0
              return (
                <li key={w.worker_id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-900 truncate">{w.name}</span>
                    <span className="text-xs text-gray-600 whitespace-nowrap tabular-nums">
                      <span className="font-semibold text-gray-900">{w.completed}</span> {tr("of")} {w.tasks} {tr("done ·")} {pct}%
                    </span>
                  </div>
                  {/* Track length = tasks assigned (relative to the busiest worker); fill = completed */}
                  <div className="mt-1.5 h-2 rounded-full bg-gray-100" title={tr("{0} completed of {1} assigned", w.completed, w.tasks)}>
                    <div className="relative h-full rounded-full bg-gray-300" style={{ width: `${(w.tasks / max) * 100}%` }}>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: BRAND_GREEN }} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-300" />{tr("Assigned")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_GREEN }} />{tr("Completed")}</span>
          </div>
        </>
      )}
    </Panel>
  )
}

// ── Detailed post-harvest charts (collapsed by default) ──────────────────────

function PostHarvestDetails({ overview }: { overview: AnalyticsOverview }) {
  const [open, setOpen] = useState(false)
  // First month of the 6-month window, as the backend counts it
  const since = overview.harvest_trend[0]?.month ?? ''
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="post-harvest-details"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left rounded-xl hover:bg-gray-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{tr("Post-Harvest Trends & Activity")}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{tr("Harvest volume, grade split, recent batches and worker tasks · last 6 months")}</p>
        </div>
        <ChevronDown {...ICON} className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Charts mount only when opened, so they measure their real width */}
      {open && (
        <div id="post-harvest-details" className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-4 rounded-b-xl">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <HarvestVolume trend={overview.harvest_trend} />
            <GradeSplit grades={overview.grade_distribution} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            <RecentHarvests rows={overview.recent_harvests} />
            <WorkerPerformance workers={overview.worker_performance} since={since} />
          </div>
        </div>
      )}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const user = authService.getUser()

  const [hStats, setHStats]     = useState<HarvestStats | null>(null)
  const [tStats, setTStats]     = useState<TransportEfficiency | null>(null)
  const [wStats, setWStats]     = useState<WasteStats | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [phLoading, setPhLoading] = useState(true)
  const [phError, setPhError]   = useState('')

  const [sulur, setSulur]       = useState<SulurAnalytics | null>(null)
  const [sulurLoading, setSulurLoading] = useState(true)
  const [sulurError, setSulurError] = useState('')

  const [farmName, setFarmName] = useState<string | null>(null)

  // The two modules load independently, so one failing never hides the other
  const loadPostHarvest = useCallback(() => {
    setPhLoading(true)
    setPhError('')
    Promise.all([
      apiClient.getHarvestStats(),
      apiClient.getTransportEfficiency(),
      apiClient.getWasteStats(),
      apiClient.getAnalyticsOverview(6),
    ])
      .then(([h, t, w, o]) => { setHStats(h); setTStats(t); setWStats(w); setOverview(o) })
      .catch((err) => setPhError(apiErrorMessage(err, tr("Failed to load post-harvest data."))))
      .finally(() => setPhLoading(false))
  }, [])

  const loadSulur = useCallback(() => {
    setSulurLoading(true)
    setSulurError('')
    apiClient.getSulurAnalytics(6)
      .then(setSulur)
      .catch((err) => setSulurError(apiErrorMessage(err, tr("Failed to load Sulur Inventory data."))))
      .finally(() => setSulurLoading(false))
  }, [])

  useEffect(() => { loadPostHarvest(); loadSulur() }, [loadPostHarvest, loadSulur])

  useEffect(() => {
    // The greeting should not block or fail the dashboard
    apiClient.getSettings()
      .then((s) => {
        const name = s.farm_name?.trim()
        setFarmName(name && name !== UNCONFIGURED_FARM_NAME ? name : FALLBACK_FARM_NAME)
      })
      .catch(() => setFarmName(FALLBACK_FARM_NAME))
  }, [])

  const alerts: UnifiedAlert[] = [
    ...(sulur && !sulurError ? sulurAlerts(sulur) : []),
    ...(overview && !phError ? postHarvestAlerts(overview.alerts) : []),
  ]
  const unavailable: ModuleKey[] = [
    ...(sulurError ? ['sulur' as const] : []),
    ...(phError ? ['post_harvest' as const] : []),
  ]

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-[1400px]">
        <WelcomeBanner name={user?.full_name || user?.username || 'there'} farmName={farmName} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <SulurOverview data={sulurError ? null : sulur} error={sulurError} onRetry={loadSulur} />
          <PostHarvestOverview hStats={hStats} tStats={tStats} wStats={wStats} overview={overview}
            error={phError} onRetry={loadPostHarvest} />
        </div>

        <NeedsAttention alerts={alerts} loading={sulurLoading || phLoading} unavailable={unavailable} />

        {overview && !phError && <PostHarvestDetails overview={overview} />}
      </div>
    </AdminLayout>
  )
}
