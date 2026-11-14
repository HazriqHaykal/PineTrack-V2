import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Check, ChevronRight, History, Info, Recycle, RefreshCw, ShieldAlert, Truck, X,
} from 'lucide-react'
import AdminLayout from '../components/layout/AdminLayout'
import WorkerLayout from '../components/layout/WorkerLayout'
import LifecycleBadge, { LifecycleStage, STAGES, STAGE_OF } from '../components/batch/LifecycleBadge'
import GradeBadge from '../components/batch/GradeBadge'
import GradingPanel from '../components/batch/GradingPanel'
import { eventInfo } from '../components/batch/eventInfo'
import { TransportStatusBadge } from '../components/transport/TransportStatus'
import { apiClient, apiErrorMessage } from '../services/api'
import { authService } from '../services/auth'
import { BatchDetails as BatchDetailsData, BatchEventList, BatchLifecycle, BatchQuantities } from '../types'
import AppSelect from '../components/ui/AppSelect'

// ── Presentation maps ────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-700',
  graded:     'bg-blue-100 text-blue-800',
  processed:  'bg-green-100 text-green-800',
  rejected:   'bg-red-100 text-red-800',
}

const label = (s?: string | null) => (s ?? '').replace(/_/g, ' ')
const kg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Tab = 'journey' | 'grading' | 'quantities' | 'records'
const TABS: Tab[] = ['journey', 'grading', 'quantities', 'records']

// ── Small building blocks ────────────────────────────────────────────────────

/** A term with its definition available on hover (and to screen readers) */
function Term({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {children}
      <Info size={12} className="opacity-60 shrink-0 cursor-help" aria-hidden />
      <span className="sr-only">: {hint}</span>
    </span>
  )
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${className}`}>
      {children}
    </span>
  )
}

function KpiCards({ q }: { q: BatchQuantities }) {
  const cards = [
    {
      name: 'Harvested', value: q.harvested_kg,
      sub: `${kg(q.marketable_kg)} marketable`,
      hint: 'Original weight recorded at harvest.',
    },
    {
      name: 'Reserved / Allocated', value: q.reserved_kg,
      sub: q.in_transit_kg ? `${kg(q.in_transit_kg)} on the road` : 'Awaiting dispatch',
      hint: 'Held by pending or in-transit transports.',
    },
    {
      name: 'Available', value: q.available_kg,
      sub: q.withheld_kg ? `${kg(q.withheld_kg)} withheld (rejected)` : `${kg(q.delivered_kg)} already delivered`,
      hint: 'Marketable stock not yet reserved or delivered; free to allocate.',
      highlight: true,
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {cards.map((c) => (
        <div
          key={c.name}
          className={`rounded-xl px-4 py-3 ${c.highlight ? 'bg-green-800 text-white shadow-sm' : 'bg-white border border-gray-200 shadow-sm'}`}
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${c.highlight ? 'text-green-50' : 'text-gray-600'}`}>
            <Term hint={c.hint}>{c.name}</Term>
          </p>
          <p className={`text-2xl font-bold mt-0.5 tabular-nums ${c.highlight ? 'text-white' : 'text-gray-900'}`}>{kg(c.value)}</p>
          <p className={`text-xs mt-0.5 truncate ${c.highlight ? 'text-green-50' : 'text-gray-600'}`}>{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

function Warnings({ q }: { q: BatchQuantities }) {
  const items: string[] = []
  if (q.over_allocated_kg > 0)
    items.push(`Transports exceed the marketable quantity by ${kg(q.over_allocated_kg)}. These records predate allocation checks; review them on the Transport page.`)
  if (q.unquantified_transports > 0)
    items.push(`${q.unquantified_transports} linked transport(s) have no cargo weight, so they are not counted in the quantities.`)
  if (q.waste_exceeds_losses_kg > 0)
    items.push(`Recorded waste is ${kg(q.waste_exceeds_losses_kg)} more than the batch's spoilage and rejection. Update the grading figures or the waste records.`)
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
      {items.map((msg) => (
        <p key={msg} className="flex gap-2 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />{msg}
        </p>
      ))}
    </div>
  )
}

// ── Tab: Journey ─────────────────────────────────────────────────────────────

const MAIN_PATH: LifecycleStage[] = ['recorded', 'ready', 'allocated', 'in_transit', 'delivered']
const REJECTED_PATH: LifecycleStage[] = ['recorded', 'rejected']

/** Where the batch sits in the process: done steps, the current step, and what is still ahead */
function LifecycleStepper({ lifecycle }: { lifecycle: BatchLifecycle }) {
  const current = STAGE_OF[lifecycle.code]
  const path = current === 'rejected' ? REJECTED_PATH : MAIN_PATH
  const currentIdx = path.indexOf(current)
  const finished = lifecycle.code === 'delivered'

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-4 mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Lifecycle</p>
      <ol className="flex items-start">
        {path.map((stage, i) => {
          const meta = STAGES.find((s) => s.stage === stage)!
          const done = i < currentIdx || (i === currentIdx && finished)
          const isCurrent = i === currentIdx
          const rejected = isCurrent && stage === 'rejected'
          const name = isCurrent && lifecycle.code === 'partially_delivered' ? 'Part Delivered' : meta.label
          return (
            <li key={stage} className="relative flex flex-1 flex-col items-center text-center min-w-0"
              aria-current={isCurrent ? 'step' : undefined}>
              {i > 0 && (
                <span aria-hidden className={`absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                  i <= currentIdx ? 'bg-green-700' : 'bg-gray-200'
                }`} />
              )}
              <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                rejected ? 'bg-red-600 text-white ring-4 ring-red-100'
                : isCurrent ? 'bg-green-700 text-white ring-4 ring-green-100'
                : done ? 'bg-green-700 text-white'
                : 'bg-white text-gray-500 border border-gray-300'
              }`}>
                {rejected ? <X size={14} strokeWidth={2.5} />
                  : done ? <Check size={14} strokeWidth={2.5} />
                  : i + 1}
              </span>
              <span className={`mt-2 px-1 text-xs leading-tight ${
                isCurrent ? (rejected ? 'font-semibold text-red-700' : 'font-semibold text-gray-900')
                : done ? 'text-gray-800' : 'text-gray-500'
              }`}>
                {name}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-sm text-gray-700">
        <span className="font-medium text-gray-900">Now: </span>{lifecycle.reason}
      </p>
    </div>
  )
}

function Journey({ batchId, refreshKey, lifecycle }: { batchId: number; refreshKey: number; lifecycle: BatchLifecycle }) {
  const [filter, setFilter] = useState('')
  const [data, setData] = useState<BatchEventList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiClient.getBatchEvents(batchId, filter)
      .then((res) => { if (active) { setData(res); setError(null) } })
      .catch((err) => { if (active) setError(apiErrorMessage(err, 'Failed to load the timeline')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [batchId, filter, refreshKey])

  return (
    <div>
      <LifecycleStepper lifecycle={lifecycle} />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <p className="text-sm text-gray-600">
          Everything recorded for this batch, newest first{data ? ` · ${data.total} event${data.total === 1 ? '' : 's'}` : ''}
        </p>
        {data && data.event_types.length > 1 && (
          <AppSelect size="sm" aria-label="Filter events by type" value={filter} onChange={setFilter}
            highlighted={filter !== ''} triggerClassName="w-auto min-w-[11rem]"
            options={[{ value: '', label: 'All events' }, ...data.event_types.map((t) => ({ value: t, label: eventInfo(t).title }))]} />
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-2" />
          Loading journey…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
          <History size={28} className="mb-2 opacity-40" />
          <p className="text-sm">{filter ? 'No events of this type.' : 'No activity has been recorded for this batch yet.'}</p>
        </div>
      ) : data && (
        <ol className={`relative space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <span className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" aria-hidden />
          {data.items.map((e) => {
            const info = eventInfo(e.event_type)
            const Icon = info.icon
            return (
              <li key={e.id} className="relative flex gap-3">
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${info.tone}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold text-sm text-gray-900">{info.title}</p>
                    <time className="text-xs text-gray-400 whitespace-nowrap" dateTime={e.created_at}>{formatTime(e.created_at)}</time>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 break-words">{e.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{e.actor_name} · {e.related_module}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {data && !data.history_complete && (
        <p className="flex gap-2 mt-5 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          <Info size={14} className="shrink-0 mt-0.5" />{data.history_note}
        </p>
      )}
    </div>
  )
}

// ── Tab: Quantities ──────────────────────────────────────────────────────────

function LedgerRow({ color, name, hint, value, sign, strong }: {
  color?: string; name: string; hint: string; value: number; sign?: string; strong?: boolean
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 text-sm ${strong ? 'border-t border-gray-200 font-semibold text-gray-900' : 'text-gray-800'}`}>
      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color ?? 'bg-transparent'}`} aria-hidden />
      <span className="min-w-0 truncate"><Term hint={hint}>{name}</Term></span>
      <span className="ml-auto whitespace-nowrap tabular-nums font-medium text-gray-900">
        {sign && <span className="text-gray-600 mr-1">{sign}</span>}{kg(value)}
      </span>
    </div>
  )
}

function Quantities({ q, yieldPercent }: { q: BatchQuantities; yieldPercent: number }) {
  // Each kilogram of the harvest sits in exactly one segment, so the bar never double counts
  const usage = [
    { name: 'Delivered',          value: q.delivered_kg,  color: 'bg-green-700', hint: 'Cargo of transports marked delivered.' },
    { name: 'In transit',         value: q.in_transit_kg, color: 'bg-blue-500',  hint: 'Cargo of transports currently on the road.' },
    { name: 'Reserved, pending',  value: q.pending_kg,    color: 'bg-amber-500', hint: 'Cargo of transports booked but not yet dispatched.' },
    { name: 'Available',          value: q.available_kg,  color: 'bg-teal-500',  hint: 'Free to allocate to a new transport.' },
    ...(q.withheld_kg > 0
      ? [{ name: 'Withheld', value: q.withheld_kg, color: 'bg-gray-500', hint: 'Marketable on paper, but the batch was rejected at grading, so it cannot be allocated.' }]
      : []),
  ]
  const graded = q.grading_basis === 'grade_based'
  const losses = graded
    ? [
        ...(q.non_marketable_kg > 0
          ? [{ name: 'Excluded grades', value: q.non_marketable_kg, color: 'bg-gray-500', hint: 'Grades the farm marketability policy does not sell.' }]
          : []),
        ...(q.rejected_at_sorting_kg > 0
          ? [{ name: 'Non-marketable at sorting', value: q.rejected_at_sorting_kg, color: 'bg-gray-500', hint: 'Fruit sorted out as unsellable at harvest; logged in Waste Management.' }]
          : []),
        { name: 'Spoiled',  value: q.spoilage_kg, color: 'bg-orange-500', hint: 'Graded fruit found spoiled.' },
        { name: 'Rejected after grading', value: Math.round((q.rejected_kg - q.rejected_at_sorting_kg) * 100) / 100, color: 'bg-red-600', hint: 'Graded fruit rejected later.' },
      ]
    : [
        { name: 'Spoiled',  value: q.spoilage_kg, color: 'bg-orange-500', hint: 'Spoilage recorded at grading.' },
        { name: 'Rejected', value: q.rejected_kg, color: 'bg-red-600',    hint: 'Rejected at grading.' },
      ]
  const segments = [...usage, ...losses].filter((s) => s.value > 0)
  const total = Math.max(q.harvested_kg, segments.reduce((sum, s) => sum + s.value, 0)) || 1

  return (
    <div className="space-y-6">
      {/* Distribution */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">Where the harvest is now</p>
          <p className="text-xs font-medium text-gray-700 tabular-nums">{kg(q.harvested_kg)} in total</p>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200 gap-px" role="img"
          aria-label={segments.map((s) => `${s.name} ${kg(s.value)}`).join(', ')}>
          {segments.map((s) => (
            <div key={s.name} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.name}: ${kg(s.value)}`} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3" aria-hidden>
          {segments.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-xs text-gray-700">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
              {s.name}
              <span className="font-semibold text-gray-900 tabular-nums">{Math.round((s.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ledger: losses on the left, how the marketable stock is used on the right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">From harvest to marketable</p>
          <LedgerRow name="Harvested" hint="Original weight recorded at harvest." value={q.harvested_kg} />
          {losses.map((l) => <LedgerRow key={l.name} color={l.color} name={l.name} hint={l.hint} value={l.value} sign="−" />)}
          <LedgerRow strong name={`Marketable (${yieldPercent}%)`}
            hint={graded
              ? "Marketable grades minus spoiled and rejected. The percentage is the batch's marketable yield."
              : "Harvested minus spoiled and rejected. The percentage is the batch's marketable yield (legacy calculation)."}
            value={q.marketable_kg} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">How marketable stock is used</p>
          {usage.map((u) => <LedgerRow key={u.name} color={u.color} name={u.name} hint={u.hint} value={u.value} />)}
          <LedgerRow strong name="Dispatched so far" hint="In transit plus delivered: everything that has left the farm."
            value={q.dispatched_kg} />
        </div>
      </div>

      <details className="group rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-700">
        <summary className="flex items-center gap-2 cursor-pointer list-none font-medium text-gray-700">
          <Recycle size={14} className="text-gray-500" />
          {kg(q.waste_recorded_kg)} of waste recorded against {kg(q.recorded_losses_kg)} of losses
          <ChevronRight size={14} className="ml-auto text-gray-500 transition-transform group-open:rotate-90" />
        </summary>
        <p className="mt-2 leading-relaxed">
          {q.waste_policy}
          {q.unclassified_losses_kg > 0 && ` ${kg(q.unclassified_losses_kg)} of losses has no waste record yet.`}
        </p>
      </details>
    </div>
  )
}

// ── Tab: Related records ─────────────────────────────────────────────────────

function RecordSection({ title, link, linkLabel, hidden, empty, children, count }: {
  title: string; link: string; linkLabel: string; hidden: number; empty: string; children: React.ReactNode; count: number
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title} · {count}</h3>
        <Link to={link} className="flex items-center gap-0.5 text-xs font-medium text-green-700 hover:underline whitespace-nowrap">
          {linkLabel} <ChevronRight size={13} />
        </Link>
      </div>
      {count === 0 ? (
        <p className="text-sm text-gray-400 py-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100">{children}</ul>
      )}
      {hidden > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          {hidden} more record(s) on this batch are managed by other users. They are included in the quantities.
        </p>
      )}
    </section>
  )
}

function RelatedRecords({ details, isAdmin }: { details: BatchDetailsData; isAdmin: boolean }) {
  const { transports, waste } = details
  return (
    <div className="space-y-6">
      <RecordSection
        title="Transport" count={transports.items.length} hidden={transports.hidden_count}
        link={isAdmin ? '/transport' : '/transport-update'} linkLabel="Open Transport"
        empty="No transports are linked to this batch."
      >
        {transports.items.map((t) => (
          <li key={t.id}>
            <Link to={`/transport/${t.id}`} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Truck size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{t.destination}</p>
              <p className="text-xs text-gray-400 truncate">
                Scheduled {t.scheduled_date}{t.actual_delivery ? ` · delivered ${t.actual_delivery}` : ''}{t.vehicle_number ? ` · ${t.vehicle_number}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {t.cargo_weight_kg != null ? kg(t.cargo_weight_kg) : '—'}
              </span>
              <TransportStatusBadge status={t.status} />
            </div>
            </Link>
          </li>
        ))}
      </RecordSection>

      <RecordSection
        title="Waste" count={waste.items.length} hidden={waste.hidden_count}
        link={isAdmin ? '/waste' : '/my-records'} linkLabel={isAdmin ? 'Open Waste' : 'Open My Records'}
        empty="No waste records are linked to this batch."
      >
        {waste.items.map((w) => (
          <li key={w.id} className="flex items-center gap-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-50 text-lime-700"><Recycle size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 capitalize truncate">{label(w.waste_type)}</p>
              <p className="text-xs text-gray-400 truncate capitalize">
                {w.waste_date} · {label(w.classification)}{w.disposal_method ? ` · ${w.disposal_method}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap shrink-0">{kg(w.quantity_kg)}</span>
          </li>
        ))}
      </RecordSection>

      {/* Tasks carry no batch link in the backend, so none can be listed truthfully */}
      <p className="flex gap-2 text-xs text-gray-400">
        <Info size={13} className="shrink-0 mt-0.5" />
        Scheduled tasks are not linked to individual batches, so none are listed here.
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BatchDetails() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isAdmin = authService.isAdmin()
  const id = Number(batchId)
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'journey'

  const [details, setDetails] = useState<BatchDetailsData | null>(null)
  const [error, setError] = useState<{ status?: number; msg: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError({ status: 404, msg: 'Batch not found' })
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setDetails(await apiClient.getBatchDetails(id))
      setError(null)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError({ status, msg: apiErrorMessage(err, 'Failed to load the batch') })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const Layout = isAdmin ? AdminLayout : WorkerLayout
  const backPath = isAdmin ? '/harvest' : '/my-records'
  const refresh = () => { load(); setRefreshKey((k) => k + 1) }
  const selectTab = (t: Tab) => setParams(t === 'journey' ? {} : { tab: t }, { replace: true })

  let body: React.ReactNode
  if (loading && !details) {
    body = (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
        Loading batch…
      </div>
    )
  } else if (error && !details) {
    const denied = error.status === 403
    body = (
      <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-xl border border-gray-100 shadow-sm px-4">
        {denied ? <ShieldAlert size={36} className="text-gray-300 mb-2" /> : <AlertTriangle size={36} className="text-gray-300 mb-2" />}
        <p className="font-medium text-gray-700">
          {denied ? 'You do not have access to this batch' : error.status === 404 ? 'Batch not found' : 'Could not load this batch'}
        </p>
        <p className="text-sm text-gray-400 mt-1">{error.msg}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate(backPath)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Back
          </button>
          {!denied && error.status !== 404 && (
            <button onClick={load} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              Try again
            </button>
          )}
        </div>
      </div>
    )
  } else if (details) {
    const { batch, lifecycle, quantities, transports, waste } = details
    const meta: [string, React.ReactNode][] = [
      ['Field', batch.field_name],
      ['Harvest date', formatDate(batch.harvest_date)],
      ['Ripeness', batch.ripeness_level != null ? `${batch.ripeness_level} / 10` : 'Not recorded'],
      ['Recorded by', details.created_by || 'Unknown'],
    ]
    const tabLabels: Record<Tab, string> = {
      journey: 'Journey',
      grading: 'Grading & Yield',
      quantities: 'Quantities',
      records: `Related Records (${transports.items.length + waste.items.length})`,
    }

    body = (
      <div className="space-y-5">
        {/* Header */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap tabular-nums mr-1">{batch.batch_number}</h1>
              <LifecycleBadge code={lifecycle.code} label={lifecycle.label} />
              <GradeBadge grade={batch.quality_grade} />
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw size={14} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-4">
            {meta.map(([name, value]) => (
              <div key={name} className="min-w-0">
                <dt className="text-xs text-gray-500">{name}</dt>
                <dd className="text-sm font-medium text-gray-900 truncate mt-0.5" title={typeof value === 'string' ? value : undefined}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <Term hint="The quality-grading step recorded on the batch: pending, graded, processed or rejected.">Grading status</Term>
            <Badge className={STATUS_STYLES[batch.harvest_status] || 'bg-gray-100 text-gray-700'}>{batch.harvest_status}</Badge>
          </div>
        </section>

        <KpiCards q={quantities} />
        <Warnings q={quantities} />

        {/* Tabs */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div role="tablist" aria-label="Batch information" className="flex gap-1 px-3 border-b border-gray-100 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                onClick={() => selectTab(t)}
                className={`px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tabLabels[t]}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5">
            {tab === 'journey' && <Journey batchId={batch.id} refreshKey={refreshKey} lifecycle={lifecycle} />}
            {tab === 'grading' && <GradingPanel batchId={batch.id} grading={details.grading} onSaved={refresh} />}
            {tab === 'quantities' && <Quantities q={quantities} yieldPercent={batch.marketable_yield_percent} />}
            {tab === 'records' && <RelatedRecords details={details} isAdmin={isAdmin} />}
          </div>
        </section>
      </div>
    )
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft size={15} /> {isAdmin ? 'Harvest Management' : 'My Records'}
        </button>
        {body}
      </div>
    </Layout>
  )
}
