import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Eye, Pencil, Plus, RefreshCw, Search, Lightbulb, Trash2, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useCreateFromQuery } from '../../hooks/useCreateFromQuery'
import IconButton from '../../components/ui/IconButton'
import GuidePopover from '../../components/ui/GuidePopover'
import { ConfirmDialog, Dialog, btnPrimary, btnSecondary } from '../../components/ui/Dialog'
import RecommendationCard from '../../components/waste/RecommendationCard'
import {
  CLASSIFICATIONS, CURRENCY, ROUTE_DOT, WASTE_TYPES, classLabel, formatRange, formatRate, typeLabel,
} from '../../components/waste/wasteMeta'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Harvest, RecoveryRate, RecoveryRoute, Waste, WasteAnalysis } from '../../types'
import AppSelect from '../../components/ui/AppSelect'
import SearchableSelect from '../../components/ui/SearchableSelect'

import { tr, locale } from '../../i18n'
const BATCH_SIZE = 25 // backend limit per analysis request

const CLASS_BADGE: Record<string, string> = {
  compostable:      'bg-green-50 text-green-800 ring-green-200',
  recyclable:       'bg-blue-50 text-blue-800 ring-blue-200',
  'non-recyclable': 'bg-gray-100 text-gray-700 ring-gray-300',
}
const kgFmt = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
const dateFmt = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function ClassBadge({ c }: { c: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${CLASS_BADGE[c] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
      {classLabel(c)}
    </span>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  harvest_id: '', waste_type: 'rotten', quantity_kg: '', classification: 'compostable', disposal_method: '', notes: '',
}
type FormState = typeof EMPTY_FORM
type FormErrors = Partial<Record<keyof FormState, string>>

function validate(f: FormState): FormErrors {
  const e: FormErrors = {}
  const q = Number(f.quantity_kg)
  if (!f.quantity_kg.trim()) e.quantity_kg = tr("Enter the weight of the waste.")
  else if (!Number.isFinite(q) || q <= 0) e.quantity_kg = tr("Quantity must be a number greater than 0.")
  if (f.disposal_method.length > 100) e.disposal_method = tr("Keep the disposal method under 100 characters.")
  return e
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 ${
    err ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-green-600'
  }`

function Field({ id, label, required, hint, error, className, children }: {
  id: string; label: string; required?: boolean; hint?: React.ReactNode; error?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function FormSection({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h4 className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 mb-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-50 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-200">{step}</span>
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div role="status" className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
    }`}>{msg}</div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type RouteFilter = 'all' | 'unanalysed' | RecoveryRoute

export default function WastePage() {
  const [records, setRecords]   = useState<Waste[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [harvests, setHarvests] = useState<Harvest[]>([])

  const [analyses, setAnalyses] = useState<Record<number, WasteAnalysis>>({})
  const [rates, setRates]       = useState<RecoveryRate[]>([])
  const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState<Set<number>>(new Set())
  const [bulk, setBulk]         = useState<{ done: number; total: number } | null>(null)

  const [search, setSearch]     = useState('')
  const [typeF, setTypeF]       = useState('all')
  const [classF, setClassF]     = useState('all')
  const [routeF, setRouteF]     = useState<RouteFilter>('all')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewing, setViewing]   = useState<Waste | null>(null)
  const [modalOpen, setModal]   = useState(false)
  const [editing, setEditing]   = useState<Waste | null>(null)
  const [form, setForm]         = useState<FormState>({ ...EMPTY_FORM })
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<Waste | null>(null)
  const [busy, setBusy]         = useState(false)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await apiClient.getWasteAnalyses()
      setAnalyses(Object.fromEntries(res.items.map((a) => [a.waste_id, a])))
      setRates(res.rates)
      setAgentAvailable(res.agent_available)
      setAnalysisError(null)
    } catch (err) {
      setAnalysisError(apiErrorMessage(err, tr("Could not load PineTrack Agent analyses")))
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await apiClient.listWaste(0, 1000)
      setRecords(d.items || [])
      setTotal(d.total ?? d.items.length)
      setLoadError(null)
      await loadAnalyses()
    } catch (err) {
      setLoadError(apiErrorMessage(err, tr("Failed to load waste records")))
    } finally {
      setLoading(false)
    }
  }, [loadAnalyses])

  useEffect(() => {
    load()
    apiClient.listHarvests(0, 500).then((d) => setHarvests(d.items)).catch(() => setHarvests([]))
  }, [load])

  /** Ask the agent about these records, BATCH_SIZE per request, merging results as they arrive */
  const analyse = async (ids: number[], quiet = false) => {
    if (!ids.length) return
    setAnalysing((s) => new Set([...s, ...ids]))
    if (ids.length > 1) setBulk({ done: 0, total: ids.length })
    let failed = 0
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE)
      try {
        const items = await apiClient.analyseWaste(chunk)
        setAnalyses((prev) => ({ ...prev, ...Object.fromEntries(items.map((a) => [a.waste_id, a])) }))
      } catch (err) {
        failed += chunk.length
        if (!quiet) showToast(apiErrorMessage(err, tr("PineTrack Agent could not analyse the records")), 'error')
      }
      setAnalysing((s) => { const n = new Set(s); chunk.forEach((id) => n.delete(id)); return n })
      if (ids.length > 1) setBulk({ done: Math.min(i + BATCH_SIZE, ids.length), total: ids.length })
    }
    setBulk(null)
    if (!quiet && !failed && ids.length > 1) showToast(tr("{0} records analysed", ids.length), 'success')
  }

  // ── Derived ──

  const current = (w: Waste) => { const a = analyses[w.id]; return a && !a.stale ? a : undefined }
  const rateFor = (route: RecoveryRoute) => rates.find((r) => r.route === route)
  const sumKg = (list: Waste[]) => list.reduce((s, w) => s + w.quantity_kg, 0)

  const totalKg = sumKg(records)
  const compostKg = sumKg(records.filter((w) => w.classification === 'compostable'))
  const recycleKg = sumKg(records.filter((w) => w.classification === 'recyclable'))
  const pct = (n: number) => (totalKg ? Math.round((n / totalKg) * 100) : 0)

  const pending = records.filter((w) => !current(w))      // never analysed, or outdated
  const valued = records.map(current).filter((a): a is WasteAnalysis => !!a && a.value_low != null)
  const valueLow = valued.reduce((s, a) => s + (a.value_low ?? 0), 0)
  const valueHigh = valued.reduce((s, a) => s + (a.value_high ?? 0), 0)

  const routeTotals = rates.map((r) => {
    const list = records.filter((w) => current(w)?.route === r.route)
    return {
      ...r,
      kg: sumKg(list),
      valueLow: list.reduce((s, w) => s + (current(w)!.value_low ?? 0), 0),
      valueHigh: list.reduce((s, w) => s + (current(w)!.value_high ?? 0), 0),
    }
  }).filter((r) => r.kg > 0)
  const pendingKg = sumKg(pending)

  const q = search.trim().toLowerCase()
  const filtered = records.filter((w) => {
    const a = current(w)
    return (!q || [typeLabel(w.waste_type), w.batch_number, w.disposal_method, w.notes, a?.action]
      .some((v) => (v ?? '').toLowerCase().includes(q)))
      && (typeF === 'all' || w.waste_type === typeF)
      && (classF === 'all' || w.classification === classF)
      && (routeF === 'all' || (routeF === 'unanalysed' ? !a : a?.route === routeF))
  })
  const filtersActive = !!q || typeF !== 'all' || classF !== 'all' || routeF !== 'all'
  const clearFilters = () => { setSearch(''); setTypeF('all'); setClassF('all'); setRouteF('all') }

  const selected = records.find((w) => w.id === selectedId) ?? null

  const select = (id: number) => {
    setSelectedId(id)
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  // ── Form ──

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowErrors(false); setSubmitError(null); setModal(true) }
  useCreateFromQuery(openCreate)

  const openEdit = (w: Waste) => {
    setViewing(null)
    setEditing(w)
    setForm({
      harvest_id: w.harvest_id ? String(w.harvest_id) : '', waste_type: w.waste_type, quantity_kg: String(w.quantity_kg),
      classification: w.classification, disposal_method: w.disposal_method || '', notes: w.notes || '',
    })
    setShowErrors(false); setSubmitError(null); setModal(true)
  }

  const errors = validate(form)
  const err = (k: keyof FormState) => (showErrors || (k === 'quantity_kg' && form.quantity_kg) ? errors[k] : undefined)
  const set = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setSubmitError(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(errors).length) return
    setSubmitting(true)
    const payload: Partial<Waste> = {
      harvest_id: form.harvest_id ? parseInt(form.harvest_id) : null,
      waste_type: form.waste_type as Waste['waste_type'],
      quantity_kg: parseFloat(form.quantity_kg),
      classification: form.classification as Waste['classification'],
      disposal_method: form.disposal_method,
      notes: form.notes,
    }
    try {
      const saved = editing ? await apiClient.updateWaste(editing.id, payload) : await apiClient.createWaste(payload)
      showToast(editing ? tr("Waste record updated") : tr("Waste logged"), 'success')
      setModal(false)
      setSelectedId(saved.id)
      await load()
      // New or changed facts: get fresh advice straight away
      analyse([saved.id], true)
    } catch (e2) {
      setSubmitError(apiErrorMessage(e2, tr("Failed to save the waste record")))
    } finally {
      setSubmitting(false)
    }
  }

  const applyAction = async (w: Waste, a: WasteAnalysis) => {
    try {
      await apiClient.updateWaste(w.id, { disposal_method: a.action.slice(0, 100) })
      showToast(tr("Disposal method updated"), 'success')
      load()
    } catch (e) {
      showToast(apiErrorMessage(e, tr("Could not update the disposal method")), 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiClient.deleteWaste(deleting.id)
      showToast(tr("Waste record deleted"), 'success')
      if (selectedId === deleting.id) setSelectedId(null)
      setDeleting(null); setViewing(null)
      load()
    } catch (e) {
      showToast(apiErrorMessage(e, tr("Delete failed")), 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Render helpers ──

  const batchCell = (w: Waste) => w.harvest_id
    ? <Link to={`/harvest/${w.harvest_id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-gray-900 hover:text-green-800 tabular-nums">{w.batch_number ?? `#${w.harvest_id}`}</Link>
    : <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{tr("Unlinked")}</span>

  const actionCell = (w: Waste) => {
    const a = analyses[w.id]
    if (analysing.has(w.id)) return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><RefreshCw size={12} className="animate-spin" />{tr("Analysing…")}</span>
    if (!a) return <span className="text-xs text-gray-500">{tr("Not analysed")}</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-800 max-w-[220px]" title={a.action}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${ROUTE_DOT[a.route]}`} aria-hidden />
        <span className={`truncate ${a.stale ? 'text-gray-500' : ''}`}>{a.action}</span>
        {a.stale && <span className="shrink-0 rounded px-1 py-px text-[10px] font-medium text-amber-900 bg-amber-50 ring-1 ring-inset ring-amber-200">{tr("Outdated")}</span>}
      </span>
    )
  }

  /** Recommendation area for one record, shared by the side panel and the details view */
  const insight = (w: Waste) => {
    const a = analyses[w.id]
    const running = analysing.has(w.id)
    if (!a) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center">
          <p className="text-sm font-medium text-gray-900">{tr("Not analysed yet")}</p>
          <p className="mt-1 text-xs text-gray-600">{tr("PineTrack Agent looks at the type, classification, notes and linked batch to recommend what to do with this waste.")}</p>
          <button onClick={() => analyse([w.id])} disabled={running} className={`${btnPrimary} mt-3 inline-flex items-center gap-1.5`}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} strokeWidth={1.75} />}
            {running ? tr("Analysing…") : tr("Analyse with PineTrack Agent")}
          </button>
        </div>
      )
    }
    return (
      <>
        <RecommendationCard a={a} quantityKg={w.quantity_kg} rate={rateFor(a.route)} onReanalyse={() => analyse([w.id])} busy={running} />
        {!a.stale && a.route !== 'review' && (w.disposal_method ?? '').trim().toLowerCase() !== a.action.toLowerCase() && (
          <button onClick={() => applyAction(w, a)} className="mt-2 block text-sm font-medium text-green-800 hover:underline">
            {tr("Set “")}{a.action}{tr("” as the disposal method")}
          </button>
        )}
      </>
    )
  }

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tr("Waste Management")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tr("Record post-harvest waste and let PineTrack Agent recommend how to recover value from it")}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto">
            <Plus size={16} strokeWidth={2} /> {tr("Log Waste")}
          </button>
        </div>

        {/* KPIs: recorded quantities, then the estimate kept visibly separate */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: tr("Total waste"), value: kgFmt(totalKg), sub: tr("{0} record{1}", records.length, records.length === 1 ? '' : 's') },
            { label: tr("Compostable"), value: kgFmt(compostKg), sub: tr("{0}% of total", pct(compostKg)) },
            { label: tr("Recyclable"), value: kgFmt(recycleKg), sub: tr("{0}% of total", pct(recycleKg)) },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{c.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{loading ? '—' : c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{tr("Recorded ·")} {c.sub}</p>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-green-300 bg-green-50/50 px-4 py-3">
            <p className="text-xs font-medium text-green-900 uppercase tracking-wide">{tr("Est. recovery value")}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
              {loading ? '—' : valued.length === 0 ? '—' : valueHigh === 0 ? `${CURRENCY} 0` : formatRange(valueLow, valueHigh)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {tr("Estimate, not income")}{pending.length > 0 ? tr(" · {0} record{1} not analysed", pending.length, pending.length === 1 ? '' : 's') : ''}
            </p>
          </div>
        </div>

        {/* Agent bar */}
        {!loading && !loadError && records.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{tr("Recommended handling")}</p>
                <p className="text-xs text-gray-500">
                  {agentAvailable === false
                    ? tr("PineTrack Agent is not configured (no Gemini key); analyses use the built-in rules.")
                    : tr("Analysed by PineTrack Agent from each record’s type, classification, notes and linked batch.")}
                </p>
              </div>
              {pending.length > 0 && (
                <button onClick={() => analyse(pending.map((w) => w.id))} disabled={!!bulk}
                  className={`${btnPrimary} inline-flex items-center gap-1.5 self-start md:self-auto whitespace-nowrap`}>
                  {bulk ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} strokeWidth={1.75} />}
                  {bulk ? tr("Analysing {0}/{1}…", bulk.done, bulk.total) : tr("Analyse {0} record{1}", pending.length, pending.length === 1 ? '' : 's')}
                </button>
              )}
            </div>
            {analysisError && <p className="mb-2 text-xs text-red-700">{analysisError}</p>}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 gap-px" role="img"
              aria-label={[...routeTotals.map((r) => `${r.label} ${kgFmt(r.kg)}`), pendingKg ? tr("Not analysed {0}", kgFmt(pendingKg)) : ''].filter(Boolean).join(', ')}>
              {routeTotals.map((r) => (
                <div key={r.route} className={ROUTE_DOT[r.route]} style={{ width: `${(r.kg / totalKg) * 100}%` }} title={`${r.label}: ${kgFmt(r.kg)}`} />
              ))}
              {pendingKg > 0 && <div className="bg-[repeating-linear-gradient(45deg,#e5e7eb_0_4px,#f3f4f6_4px_8px)]" style={{ width: `${(pendingKg / totalKg) * 100}%` }} title={tr("Not analysed: {0}", kgFmt(pendingKg))} />}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {routeTotals.map((r) => (
                <li key={r.route}>
                  <button onClick={() => setRouteF(routeF === r.route ? 'all' : r.route)}
                    className={`inline-flex items-center gap-1.5 text-xs rounded px-1 -mx-1 ${routeF === r.route ? 'bg-green-50 ring-1 ring-green-600' : 'hover:bg-gray-50'}`}>
                    <span className={`h-2 w-2 rounded-full ${ROUTE_DOT[r.route]}`} />
                    <span className="text-gray-800">{r.label}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{kgFmt(r.kg)}</span>
                    <span className="text-gray-500 tabular-nums">· {r.low == null ? tr("not estimated") : formatRange(r.valueLow, r.valueHigh)}</span>
                  </button>
                </li>
              ))}
              {pendingKg > 0 && (
                <li>
                  <button onClick={() => setRouteF(routeF === 'unanalysed' ? 'all' : 'unanalysed')}
                    className={`inline-flex items-center gap-1.5 text-xs rounded px-1 -mx-1 ${routeF === 'unanalysed' ? 'bg-green-50 ring-1 ring-green-600' : 'hover:bg-gray-50'}`}>
                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                    <span className="text-gray-800">{tr("Not analysed / outdated")}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{kgFmt(pendingKg)}</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
          <div className="relative flex-1 lg:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={tr("Search type, batch, action or notes…")} value={search}
              onChange={(e) => setSearch(e.target.value)} aria-label={tr("Search waste records")}
              className="w-full h-9 pl-9 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600" />
            {search && (
              <button onClick={() => setSearch('')} aria-label={tr("Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700"><X size={14} /></button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select label={tr("Waste type")} value={typeF} onChange={setTypeF}
              options={[['all', tr("All types")], ...WASTE_TYPES.map((t) => [t, typeLabel(t)] as [string, string])]} />
            <Select label={tr("Classification")} value={classF} onChange={setClassF}
              options={[['all', tr("All classifications")], ...CLASSIFICATIONS.map((c) => [c, classLabel(c)] as [string, string])]} />
            <Select label={tr("Recommended handling")} value={routeF} onChange={(v) => setRouteF(v as RouteFilter)}
              options={[['all', tr("All handling")], ...rates.map((r) => [r.route, r.label] as [string, string]), ['unanalysed', tr("Not analysed / outdated")]]} />
            {filtersActive && (
              <button onClick={clearFilters} className="text-xs font-medium text-gray-600 hover:text-gray-900 px-1">{tr("Clear filters")}</button>
            )}
          </div>
          {rates.length > 0 && (
            <div className="lg:ml-auto">
              <GuidePopover title={tr("How values are estimated")} sections={[
                { heading: tr("Who decides what"), items: [
                  { key: 'ai', dot: 'bg-green-600', label: tr("Agent"), meaning: tr("PineTrack Agent (Gemini) chooses the handling and explains why. Built-in rules answer if it is unavailable.") },
                  { key: 'calc', dot: 'bg-gray-400', label: tr("Value"), meaning: tr("PineTrack calculates value as recorded kg × the assumed rate below for the chosen handling. The AI never sets a price.") },
                ] },
                { heading: tr("Assumed rates (planning estimates)"), items: rates.map((r) => ({
                  key: r.route, dot: ROUTE_DOT[r.route], label: r.label, meaning: `${formatRate(r)}. ${r.basis}`,
                })) },
              ]} />
            </div>
          )}
        </div>

        {total > records.length && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {tr("Showing the")} {records.length} {tr("most recent of")} {total} {tr("records. Totals cover the records shown.")}
          </p>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm">
                <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-3" />
                {tr("Loading waste records…")}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <AlertTriangle size={30} className="text-gray-300 mb-2" />
                <p className="font-medium text-gray-800">{tr("Could not load waste records")}</p>
                <p className="text-sm text-gray-500 mt-1">{loadError}</p>
                <button onClick={() => { setLoading(true); load() }} className={`${btnSecondary} mt-4 inline-flex items-center gap-1.5`}>
                  <RefreshCw size={14} strokeWidth={1.75} /> {tr("Try again")}
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <p className="font-medium text-gray-800">{records.length === 0 ? tr("No waste logged yet") : tr("No records match these filters")}</p>
                {records.length === 0
                  ? <p className="text-sm text-gray-500 mt-1">{tr("Log waste and PineTrack Agent will recommend what to do with it.")}</p>
                  : <button onClick={clearFilters} className="mt-2 text-sm font-medium text-green-800 hover:underline">{tr("Clear filters")}</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[[tr("Waste type"), ''], [tr("Batch"), ''], [tr("Quantity"), 'text-right'], [tr("Classification"), ''],
                        [tr("Recommended action"), ''], [tr("Est. value"), 'text-right'], [tr("Date"), ''], [tr("Actions"), 'text-right']].map(([h, cls]) => (
                        <th key={h} className={`text-left px-4 py-3 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => {
                      const active = w.id === selectedId
                      const a = current(w)
                      return (
                        <tr key={w.id} onClick={() => select(w.id)} aria-selected={active}
                          className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${active ? 'bg-green-50/70' : 'hover:bg-gray-50/70'}`}>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{typeLabel(w.waste_type)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{batchCell(w)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">{kgFmt(w.quantity_kg)}</td>
                          <td className="px-4 py-3"><ClassBadge c={w.classification} /></td>
                          <td className="px-4 py-3">{actionCell(w)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-gray-700">
                            {a && a.value_low != null ? formatRange(a.value_low, a.value_high) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap tabular-nums">{dateFmt(w.waste_date || w.created_at)}</td>
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <IconButton icon={Eye} label={tr("View waste record #{0}", w.id)} onClick={() => setViewing(w)} />
                              <IconButton icon={Pencil} label={tr("Edit waste record #{0}", w.id)} onClick={() => openEdit(w)} />
                              <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
                              <IconButton icon={Trash2} label={tr("Delete waste record #{0}", w.id)} danger onClick={() => setDeleting(w)} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recommendation panel */}
          <aside ref={panelRef} aria-live="polite" className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 xl:sticky xl:top-6 scroll-mt-6">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{typeLabel(selected.waste_type)} · {kgFmt(selected.quantity_kg)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selected.batch_number ?? tr("Unlinked")} · {classLabel(selected.classification)} · {dateFmt(selected.waste_date)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedId(null)} aria-label={tr("Close recommendation")}
                    className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={15} /></button>
                </div>
                {insight(selected)}
                <button onClick={() => setViewing(selected)} className="mt-4 w-full text-sm font-medium text-gray-600 hover:text-gray-900">
                  {tr("View full record")}
                </button>
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold text-gray-900">{tr("PineTrack Agent recommendations")}</p>
                <p className="mt-1 text-sm text-gray-600">{tr("Select a waste record to see what the agent recommends, alternative uses and the estimated recovery value.")}</p>
              </div>
            )}
          </aside>
        </div>
        {!loading && !loadError && filtersActive && filtered.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{tr("Showing")} {filtered.length} {tr("of")} {records.length} {tr("records")}</p>
        )}
      </div>

      {/* Details */}
      {viewing && (
        <Dialog open size="lg" title={tr("Waste record #{0}", viewing.id)} onClose={() => setViewing(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeleting(viewing)}
                className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50">
                <Trash2 size={15} strokeWidth={1.75} /> {tr("Delete")}
              </button>
              <button type="button" onClick={() => setViewing(null)} className={btnSecondary}>{tr("Close")}</button>
              <button type="button" onClick={() => openEdit(viewing)} className={`${btnPrimary} inline-flex items-center gap-1.5`}>
                <Pencil size={15} strokeWidth={1.75} /> {tr("Edit")}
              </button>
            </>
          }>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {([
                  [tr("Waste type"), typeLabel(viewing.waste_type)],
                  [tr("Linked batch"), viewing.harvest_id
                    ? <Link to={`/harvest/${viewing.harvest_id}`} className="text-green-800 hover:underline">{viewing.batch_number ?? tr("Batch #{0}", viewing.harvest_id)}</Link>
                    : <span className="text-gray-500">{tr("Unlinked")}</span>],
                  [tr("Quantity (recorded)"), kgFmt(viewing.quantity_kg)],
                  [tr("Classification"), <ClassBadge c={viewing.classification} />],
                  [tr("Disposal method"), viewing.disposal_method || <span className="text-gray-500">{tr("Not recorded")}</span>],
                  [tr("Waste date"), dateFmt(viewing.waste_date)],
                  [tr("Logged"), new Date(viewing.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                ] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-gray-500">{k}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs text-gray-500">{tr("Notes")}</p>
                {viewing.notes
                  ? <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">{viewing.notes}</p>
                  : <p className="mt-1 text-sm text-gray-500">{tr("No notes.")}</p>}
              </div>
            </div>
            <div className="md:border-l md:border-gray-100 md:pl-6">{insight(viewing)}</div>
          </div>
        </Dialog>
      )}

      {/* Log / edit */}
      <Dialog
        open={modalOpen}
        size="lg"
        title={editing ? tr("Edit Waste Record #{0}", editing.id) : tr("Log Waste")}
        onClose={() => setModal(false)}
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className={btnSecondary}>{tr("Cancel")}</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? tr("Saving…") : editing ? tr("Save Changes") : tr("Log Waste")}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {submitError && (
            <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />{submitError}
            </p>
          )}

          <FormSection step="A" title={tr("Waste Identification")}>
            <Field id="harvest_id" label={tr("Harvest batch")} className="sm:col-span-2"
              hint={tr("Linking a batch adds this record to the batch's history and gives PineTrack Agent its grading data.")}>
              <SearchableSelect id="harvest_id" value={form.harvest_id} onChange={(v) => set({ harvest_id: v })}
                emptyOptionLabel={tr("No batch linked")} placeholder={tr("No batch linked")}
                searchPlaceholder={tr("Search batch number or field")} noResultsText={tr("No batches match")}
                options={harvests.map((h) => ({
                  value: String(h.id), label: h.batch_number, keywords: h.field_name,
                  description: tr("{0} · {1} kg · {2}", h.field_name, h.quantity_kg.toLocaleString(), h.harvest_date),
                }))} />
            </Field>
            <Field id="waste_type" label={tr("Waste type")} required>
              <AppSelect id="waste_type" value={form.waste_type} onChange={(v) => set({ waste_type: v })}
                options={WASTE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} />
            </Field>
            <Field id="quantity_kg" label={tr("Quantity (kg)")} required error={err('quantity_kg')}>
              <input id="quantity_kg" type="number" inputMode="decimal" min="0.1" step="0.1" value={form.quantity_kg}
                onChange={(e) => set({ quantity_kg: e.target.value })} className={inputCls(err('quantity_kg'))}
                aria-invalid={!!err('quantity_kg')} />
            </Field>
          </FormSection>

          <FormSection step="B" title={tr("Handling Details")}>
            <Field id="classification" label={tr("Classification")} required>
              <AppSelect id="classification" value={form.classification} onChange={(v) => set({ classification: v })}
                options={CLASSIFICATIONS.map((c) => ({ value: c, label: classLabel(c) }))} />
            </Field>
            <Field id="disposal_method" label={tr("Disposal method")} error={err('disposal_method')} hint={tr("Optional. You can apply the agent's recommendation later.")}>
              <input id="disposal_method" type="text" value={form.disposal_method} list="disposal-suggestions"
                onChange={(e) => set({ disposal_method: e.target.value })} placeholder={tr("e.g. Compost")} className={inputCls(err('disposal_method'))} />
              <datalist id="disposal-suggestions">
                {rates.filter((r) => r.route !== 'review').map((r) => <option key={r.route} value={r.label} />)}
              </datalist>
            </Field>
            <p className="sm:col-span-2 flex gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
              <Lightbulb size={14} strokeWidth={1.75} className="shrink-0 mt-px text-green-700" />
              {tr("After you save, PineTrack Agent analyses this record and recommends what to do with it. Detailed notes give it more to work with.")}
            </p>
          </FormSection>

          <FormSection step="C" title={tr("Additional Information")}>
            <Field id="notes" label={tr("Notes")} className="sm:col-span-2" hint={tr("For example: smell, mould, bruising, how long it has been stored.")}>
              <textarea id="notes" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })}
                placeholder={tr("Optional notes…")} className={`${inputCls()} resize-none`} />
            </Field>
          </FormSection>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={tr("Delete this waste record?")}
        body={deleting && (
          <>
            <p className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-800">
              <span className="font-medium">{typeLabel(deleting.waste_type)} · {kgFmt(deleting.quantity_kg)}</span>
              <span className="text-gray-600"> · {deleting.batch_number ?? tr("Unlinked")} · {dateFmt(deleting.waste_date)}</span>
            </p>
            {tr("The record is removed permanently. If it is linked to a batch, the removal is noted in that batch’s history.")}
          </>
        )}
        confirmLabel={tr("Delete")}
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
  return (
    <AppSelect size="sm" aria-label={label} value={value} onChange={onChange} highlighted={value !== 'all'}
      triggerClassName="min-w-[9rem]" options={options.map(([v, l]) => ({ value: v, label: l }))} />
  )
}
