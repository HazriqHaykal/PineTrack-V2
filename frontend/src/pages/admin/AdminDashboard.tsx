import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, ChevronRight, ClipboardCheck, Info, Navigation,
  Plus, Recycle, RefreshCw, Sprout, Truck, Users, XCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import GradeBadge, { GRADES, GRADE_HEX, isMixed, normalizeGrade } from '../../components/batch/GradeBadge'
import { apiClient, apiErrorMessage } from '../../services/api'
import { authService } from '../../services/auth'
import { AnalyticsOverview, HarvestStats, TransportEfficiency, WasteStats } from '../../types'

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
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
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

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-white border border-gray-100 ${className}`} />
}

// ── Welcome banner ───────────────────────────────────────────────────────────

function farmGreeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: FARM_TIMEZONE }).format(now))
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const date = now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FARM_TIMEZONE })
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
        <h1 className="text-2xl font-bold mt-1">Good {part}, {name}</h1>
        <p className="text-sm mt-1" style={{ color: '#d6eadf' }}>
          Welcome to{' '}
          <span className="font-semibold" style={{ color: '#f7bf70' }}>{farmName ?? '…'}</span>.
          {' '}Here is what is happening at your farm today.
        </p>
      </div>
    </section>
  )
}

// ── KPI cards ────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, period, onClick }: {
  icon: React.ElementType; label: string; value: string; sub: string; period: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="group text-left bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 h-full flex flex-col hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 min-w-0">
          <Icon {...ICON} className="shrink-0 text-green-800" />
          <span className="truncate">{label}</span>
        </span>
        <span className="text-[11px] text-gray-500 whitespace-nowrap">{period}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight mt-2 tabular-nums truncate">{value}</p>
      <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>
    </button>
  )
}

// ── Needs your attention ─────────────────────────────────────────────────────

type Alert = AnalyticsOverview['alerts'][number]

/**
 * Icon, rank and destination for each alert the backend raises. The link is the
 * backend's own, narrowed to a filtered list only where the filter means exactly
 * the same thing as the alert.
 */
function describeAlert(a: Alert): { icon: React.ElementType; rank: number; link: string | null; linkLabel: string } {
  const msg = a.msg.toLowerCase()
  const module = (link: string | null) =>
    ({ '/transport': 'Transport', '/schedule': 'Scheduling', '/harvest': 'Harvest', '/waste': 'Waste' } as Record<string, string>)[link ?? ''] ?? 'Open'
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
    if (msg.includes('in transit')) return { icon: Navigation, rank: 11, link: '/transport?status=in_transit', linkLabel: 'View in transit' }
    return { ...base, icon: Info, rank: 12 }
  }
  return { ...base, icon: CheckCircle2, rank: 20 }
}

const ALERT_TONE: Record<Alert['level'], { icon: string; tag: string; label: string; bar: string }> = {
  warning: { icon: 'text-amber-600', tag: 'text-amber-800', label: 'Action needed', bar: 'bg-amber-500' },
  info:    { icon: 'text-blue-600',  tag: 'text-blue-800',  label: 'Information',   bar: 'bg-blue-400' },
  success: { icon: 'text-green-700', tag: 'text-green-800', label: 'All clear',     bar: 'bg-green-600' },
}

function NeedsAttention({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate()
  const sorted = alerts.map((a) => ({ ...a, ...describeAlert(a) })).sort((x, y) => x.rank - y.rank)
  const warnings = alerts.filter((a) => a.level === 'warning').length

  return (
    <Panel
      className="h-full"
      title="Needs Your Attention"
      subtitle="Live checks on deliveries, tasks and harvest quality"
      action={warnings > 0 && (
        <span className="text-xs font-medium text-amber-900 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-md px-2 py-0.5 whitespace-nowrap">
          {warnings} to act on
        </span>
      )}
      flush
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 px-5 pb-5">No alerts right now.</p>
      ) : (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {sorted.map(({ icon: Icon, link, linkLabel, ...a }) => {
            const tone = ALERT_TONE[a.level]
            const body = (
              <>
                <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${tone.bar}`} aria-hidden />
                <Icon {...ICON} className={`shrink-0 ${tone.icon}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 leading-snug">{a.msg}</p>
                  <p className={`text-[11px] font-medium mt-0.5 ${tone.tag}`}>{tone.label}</p>
                </div>
                {link && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 group-hover:text-green-800 whitespace-nowrap">
                    {linkLabel} <ChevronRight size={14} strokeWidth={1.75} />
                  </span>
                )}
              </>
            )
            return (
              <li key={a.msg}>
                {link ? (
                  <button onClick={() => navigate(link)}
                    className="group relative flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50">
                    {body}
                  </button>
                ) : (
                  <div className="relative flex items-center gap-3 px-5 py-2.5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ── Quick actions ────────────────────────────────────────────────────────────

/** Each opens the module's existing form through its ?new=1 hook; no forms are duplicated here */
const QUICK_ACTIONS = [
  { label: 'New Harvest',   path: '/harvest?new=1',   icon: Sprout },
  { label: 'New Transport', path: '/transport?new=1', icon: Truck },
  { label: 'Assign Task',   path: '/schedule?new=1',  icon: CalendarPlus },
  { label: 'Log Waste',     path: '/waste?new=1',     icon: Recycle },
]

function QuickActions() {
  const navigate = useNavigate()
  // The dashboard is admin-only, and every action opens an admin form
  if (!authService.isAdmin()) return null
  return (
    <Panel title="Quick Actions" subtitle="Opens the module's form" className="h-full">
      <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
        {QUICK_ACTIONS.map(({ label, path, icon: Icon }) => (
          <button key={label} onClick={() => navigate(path)}
            className="group flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:border-green-700 hover:bg-green-50/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
            <Icon {...ICON} className="shrink-0 text-green-800" />
            <span className="truncate">{label}</span>
            <Plus {...ICON} size={14} className="ml-auto shrink-0 text-gray-400 group-hover:text-green-800" />
          </button>
        ))}
      </div>
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
      title="Harvest Volume"
      subtitle={`Kilograms harvested per month, last ${trend.length} months · ${kg(total)} in total`}
      action={<PanelLink to="/analytics">Analytics</PanelLink>}
    >
      {!hasData ? (
        <EmptyState text={`No harvests recorded in the last ${trend.length} months.`} />
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
                labelFormatter={(m: string) => (data.find((d) => d.month === m)?.current ? `${m} (month in progress)` : m)}
                formatter={(v: number, _n, item) => [
                  `${v.toLocaleString()} kg from ${item.payload.batches} batch${item.payload.batches === 1 ? '' : 'es'}`,
                  'Harvested',
                ]}
              />
              <Bar dataKey="kg" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {data.map((m) => <Cell key={m.month} fill={m.current ? BRAND_SAGE : BRAND_GREEN} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_GREEN }} />Full month</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_SAGE }} />* Current month, still in progress</span>
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
      name: k === 'ungraded' ? 'Ungraded' : k === 'mixed' ? 'Mixed grades' : `Grade ${k}`,
      value: counts[k],
      percent: Math.round((counts[k] / total) * 1000) / 10,
      fill: k === 'mixed' ? '#64748b' : GRADE_HEX[k],
    }))

  return (
    <Panel title="Quality Grade Split" subtitle="Batches harvested in the last 6 months, by overall grade. Grade weights are on Analytics.">
      {total === 0 ? (
        <EmptyState text="No batches harvested in this period." />
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
              <span className="text-[11px] text-gray-500">batches</span>
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
      title="Recent Harvest Activity"
      subtitle="Latest 5 batches. Select a row to open the batch."
      action={<PanelLink to="/harvest">All batches</PanelLink>}
      flush
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">No harvests recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50">
                {[['Batch', ''], ['Field', ''], ['Harvest date', ''], ['Quantity', 'text-right'], ['Grade', ''], ['Recorded by', '']].map(([h, cls]) => (
                  <th key={h} className={`text-left px-4 py-2.5 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} tabIndex={0} role="link" aria-label={`Open batch ${r.batch_number}`}
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
      title="Worker Performance"
      subtitle={`Tasks scheduled since ${since}, excluding cancelled · top ${workers.length || 8}`}
      action={<PanelLink to="/schedule">Scheduling</PanelLink>}
    >
      {workers.length === 0 ? (
        <EmptyState text="No tasks assigned in this period." />
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
                      <span className="font-semibold text-gray-900">{w.completed}</span> of {w.tasks} done · {pct}%
                    </span>
                  </div>
                  {/* Track length = tasks assigned (relative to the busiest worker); fill = completed */}
                  <div className="mt-1.5 h-2 rounded-full bg-gray-100" title={`${w.completed} completed of ${w.tasks} assigned`}>
                    <div className="relative h-full rounded-full bg-gray-300" style={{ width: `${(w.tasks / max) * 100}%` }}>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: BRAND_GREEN }} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-300" />Assigned</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND_GREEN }} />Completed</span>
          </div>
        </>
      )}
    </Panel>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user     = authService.getUser()

  const [hStats, setHStats]     = useState<HarvestStats | null>(null)
  const [tStats, setTStats]     = useState<TransportEfficiency | null>(null)
  const [wStats, setWStats]     = useState<WasteStats | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [farmName, setFarmName] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      apiClient.getHarvestStats(),
      apiClient.getTransportEfficiency(),
      apiClient.getWasteStats(),
      apiClient.getAnalyticsOverview(6),
    ])
      .then(([h, t, w, o]) => { setHStats(h); setTStats(t); setWStats(w); setOverview(o) })
      .catch((err) => setError(apiErrorMessage(err, 'Failed to load dashboard data.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    // The greeting should not block or fail the dashboard
    apiClient.getSettings()
      .then((s) => {
        const name = s.farm_name?.trim()
        setFarmName(name && name !== UNCONFIGURED_FARM_NAME ? name : FALLBACK_FARM_NAME)
      })
      .catch(() => setFarmName(FALLBACK_FARM_NAME))
  }, [])

  const ready = !error && hStats && tStats && wStats && overview
  const last30 = overview?.kpis.current
  // First month of the 6-month window, as the backend counts it
  const since = overview?.harvest_trend[0]?.month ?? ''

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-[1400px]">
        <WelcomeBanner name={user?.full_name || user?.username || 'there'} farmName={farmName} />

        {error && (
          <div className="flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle {...ICON} className="shrink-0" />
            <span className="flex-1 min-w-0">{error}</span>
            <button onClick={load} className="flex items-center gap-1.5 font-medium hover:underline">
              <RefreshCw {...ICON} size={14} /> Try again
            </button>
          </div>
        )}

        {loading && !ready && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[108px]" />)}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Skeleton className="h-48 xl:col-span-2" />
              <Skeleton className="h-48" />
            </div>
          </>
        )}

        {ready && (
          <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard icon={Sprout} period="All time" label="Total Harvested" value={kg(hStats.total_quantity_kg)}
                sub={`${hStats.total_harvests} batches · ${kg(last30?.harvest_volume_kg ?? 0)} in last 30 days`}
                onClick={() => navigate('/harvest')} />
              <KPICard icon={Truck} period="All time" label="Deliveries Completed" value={`${tStats.delivered} / ${tStats.total_transports}`}
                sub={`${tStats.in_transit} in transit · ${tStats.pending} scheduled`}
                onClick={() => navigate('/transport')} />
              <KPICard icon={Recycle} period="All time" label="Waste Logged" value={kg(wStats.total_waste_kg)}
                sub={`${wStats.total_records} records · ${kg(last30?.waste_kg ?? 0)} in last 30 days`}
                onClick={() => navigate('/waste')} />
              <KPICard icon={Users} period="Today" label="Active Workers" value={String(overview.workers.active)}
                sub={`${overview.workers.on_field_today} with tasks today`}
                onClick={() => navigate('/admin/users')} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
              <div className="xl:col-span-2"><NeedsAttention alerts={overview.alerts} /></div>
              <QuickActions />
            </div>

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
      </div>
    </AdminLayout>
  )
}
