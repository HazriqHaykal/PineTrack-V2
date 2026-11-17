import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Eye, Pencil, Plus, RefreshCw, Search, Trash2, Truck, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useCreateFromQuery } from '../../hooks/useCreateFromQuery'
import IconButton from '../../components/ui/IconButton'
import { ConfirmDialog, Dialog, btnPrimary, btnSecondary } from '../../components/ui/Dialog'
import {
  NEXT_ACTION, StatusAction, TRANSPORT_STATUSES, TRANSPORT_STATUS_META, TransportStatus,
  TransportStatusBadge, TransportStatusGuide, isLockedDelivery,
} from '../../components/transport/TransportStatus'
import {
  Allocation, EMPTY_FORM, FormState, allocationFor, fmtKg, today, validate,
} from '../../components/transport/allocation'
import { apiClient, apiErrorMessage } from '../../services/api'
import { BatchSummary, Harvest, SystemUser, Transport } from '../../types'
import SearchableSelect from '../../components/ui/SearchableSelect'

import { tr } from '../../i18n'
// ── Small building blocks ────────────────────────────────────────────────────

const inputCls = (err?: string) =>
  `w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500 ${
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
      {error
        ? <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p>
        : hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function FormSection({ step, title, description, children }: {
  step: string; title: string; description: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-green-50 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-200">
          {step}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function AllocationPanel({ alloc, weight, locked, onUseMax }: {
  alloc: Allocation; weight: number | null; locked: boolean; onUseMax: () => void
}) {
  const { batch, summary, ownShare, maxKg, rejected } = alloc
  if (!batch) return null
  const over = weight !== null && maxKg !== undefined && weight > maxKg + 0.005 && !(ownShare > 0 && weight <= ownShare)
  const pct = maxKg && weight ? Math.min((weight / maxKg) * 100, 100) : 0

  return (
    <div className={`sm:col-span-2 rounded-lg border px-3 py-3 text-sm ${
      rejected || over ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-gray-700">
          {tr("Batch")} <Link to={`/harvest/${batch.id}`} target="_blank" className="font-semibold text-gray-900 hover:text-green-800 underline-offset-2 hover:underline">{batch.batch_number}</Link>
          <span className="text-gray-500"> · {batch.field_name}</span>
        </p>
        {summary && !locked && (
          <p className="text-gray-700">
            {tr("Max for this delivery")} <span className="font-semibold text-gray-900 tabular-nums">{fmtKg(maxKg ?? 0)}</span>
          </p>
        )}
      </div>

      {locked ? (
        <p className="mt-1.5 text-xs text-gray-600">{tr("Delivered from this batch. The batch and cargo weight are locked.")}</p>
      ) : rejected ? (
        <p className="mt-1.5 text-xs text-red-700">{tr("Rejected at grading, so no stock can be allocated from it.")}</p>
      ) : !summary ? (
        <p className="mt-1.5 text-xs text-gray-600">{tr("Availability could not be loaded. The server will still check the cargo weight when you save.")}</p>
      ) : (
        <>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden" aria-hidden>
            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-green-600'}`} style={{ width: `${over ? 100 : pct}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              {fmtKg(Math.max(summary.available_kg, 0))} {tr("unallocated on the batch")}
              {ownShare > 0 && <> + {fmtKg(ownShare)} {tr("already reserved by this delivery")}</>}
            </span>
            {(maxKg ?? 0) > 0 && (
              <button type="button" onClick={onUseMax} className="font-medium text-green-800 hover:underline">
                {tr("Use maximum")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatusPill({ action, onClick }: { action: StatusAction; onClick: () => void }) {
  const Icon = action.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${action.pill}`}
    >
      <Icon size={14} strokeWidth={1.75} /> {action.label}
    </button>
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

type StatusFilter = 'all' | TransportStatus
type Pending = { kind: 'status'; transport: Transport; action: StatusAction } | { kind: 'delete'; transport: Transport }

export default function TransportPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [summaries, setSummaries]   = useState<Record<number, BatchSummary>>({})
  const [workers, setWorkers]       = useState<SystemUser[]>([])
  const [harvests, setHarvests]     = useState<Harvest[]>([])

  const [search, setSearch]             = useState('')
  // Other pages (e.g. dashboard alerts) can link to a pre-filtered list with ?status=<backend value>
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = params.get('status')
    return TRANSPORT_STATUSES.includes(s as TransportStatus) ? (s as TransportStatus) : 'all'
  })

  const [modalOpen, setModal]     = useState(false)
  const [editing, setEditing]     = useState<Transport | null>(null)
  const [form, setForm]           = useState<FormState>({ ...EMPTY_FORM })
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy]       = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      const d = await apiClient.listTransports(0, 1000)
      setTransports(d.items || [])
      setLoadError(null)
      // Stock left on each batch changes with every allocation, so refresh it alongside
      apiClient.getBatchOverview()
        .then((items) => setSummaries(Object.fromEntries(items.map((i) => [i.harvest_id, i]))))
        .catch(() => setSummaries({}))
    } catch (err) {
      setLoadError(apiErrorMessage(err, tr("Failed to load transports")))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    apiClient.listUsers().then((d) => setWorkers(d.items.filter((u) => u.is_active))).catch(() => setWorkers([]))
    apiClient.listHarvests(0, 500).then((d) => setHarvests(d.items)).catch(() => setHarvests([]))
  }, [load])

  // ── Form ──

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, scheduled_date: today() })
    setShowErrors(false)
    setSubmitError(null)
    setModal(true)
  }
  useCreateFromQuery(openCreate)

  const openEdit = (t: Transport) => {
    setEditing(t)
    setForm({
      destination:     t.destination,
      harvest_id:      t.harvest_id ? String(t.harvest_id) : '',
      cargo_weight_kg: t.cargo_weight_kg != null ? String(t.cargo_weight_kg) : '',
      scheduled_date:  t.scheduled_date,
      driver_id:       t.driver_id ? String(t.driver_id) : '',
      driver_name:     t.driver_name,
      vehicle_number:  t.vehicle_number,
      notes:           t.notes || '',
    })
    setShowErrors(false)
    setSubmitError(null)
    setModal(true)
  }

  // The details page links here with ?edit=<id> to reuse this form
  useEffect(() => {
    const editId = params.get('edit')
    if (!editId || loading) return
    const t = transports.find((x) => String(x.id) === editId)
    if (t) openEdit(t)
    else showToast(tr("That transport could not be found"), 'error')
    const next = new URLSearchParams(params)
    next.delete('edit')
    setParams(next, { replace: true })
    // openEdit only reads its argument; the URL and loaded list drive this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loading, transports])

  const alloc = useMemo(() => allocationFor(form, editing, harvests, summaries), [form, editing, harvests, summaries])
  const errors = useMemo(() => validate(form, editing, alloc), [form, editing, alloc])
  const locked = !!editing && isLockedDelivery(editing)
  const weightNum = form.cargo_weight_kg.trim() ? Number(form.cargo_weight_kg) : null
  // Cargo errors show as soon as the user types; the rest after the first submit attempt
  const visibleError = (k: keyof FormState) =>
    showErrors || (k === 'cargo_weight_kg' && form.cargo_weight_kg) || (k === 'harvest_id' && form.harvest_id)
      ? errors[k] : undefined

  const set = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setSubmitError(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(errors).length) return
    setSubmitting(true)
    setSubmitError(null)
    const payload: Partial<Transport> = {
      destination:     form.destination.trim(),
      driver_name:     form.driver_name.trim(),
      vehicle_number:  form.vehicle_number.trim(),
      scheduled_date:  form.scheduled_date,
      cargo_weight_kg: form.cargo_weight_kg.trim() ? parseFloat(form.cargo_weight_kg) : undefined,
      notes:           form.notes,
      driver_id:       form.driver_id ? parseInt(form.driver_id) : null,
      harvest_id:      form.harvest_id ? parseInt(form.harvest_id) : null,
    }
    try {
      if (editing) {
        // Status is not part of the edit form; it changes only through the workflow actions
        await apiClient.updateTransport(editing.id, payload)
        showToast(tr("Transport updated"), 'success')
      } else {
        await apiClient.createTransport({ ...payload, status: 'pending' })
        showToast(tr("Transport scheduled"), 'success')
      }
      setModal(false)
      load()
    } catch (err) {
      // Includes the server's locked allocation check, e.g. when another user reserved the stock first
      setSubmitError(apiErrorMessage(err, tr("Failed to save transport")))
      load()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Status changes & delete ──

  const confirmPending = async () => {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.kind === 'status') {
        await apiClient.updateTransportStatus(pending.transport.id, pending.action.to)
        showToast(tr("Marked {0}", TRANSPORT_STATUS_META[pending.action.to].label), 'success')
      } else {
        await apiClient.deleteTransport(pending.transport.id)
        showToast(tr("Transport deleted"), 'success')
      }
      setPending(null)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, pending.kind === 'delete' ? tr("Delete failed") : tr("Status update failed")), 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Filtering ──

  const query = search.trim().toLowerCase()
  const filtered = transports.filter((t) => {
    const matchSearch = !query || [t.destination, t.driver_name, t.vehicle_number, t.batch_number, `#${t.id}`]
      .some((v) => (v ?? '').toLowerCase().includes(query))
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })
  const filtersActive = !!query || statusFilter !== 'all'
  const clearFilters = () => { setSearch(''); setStatusFilter('all') }

  const count = (s: TransportStatus) => transports.filter((t) => t.status === s).length
  const kpis = [
    { label: tr("Total deliveries"), value: transports.length, dot: 'bg-gray-400' },
    ...(['pending', 'in_transit', 'delivered'] as TransportStatus[]).map((s) => ({
      label: TRANSPORT_STATUS_META[s].label, value: count(s), dot: TRANSPORT_STATUS_META[s].dot,
    })),
  ]

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tr("Transport Management")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tr("Schedule deliveries and track them from farm to destination")}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto">
            <Plus size={16} strokeWidth={2} /> {tr("New Transport")}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wide">
                <span className={`h-2 w-2 rounded-full ${k.dot}`} aria-hidden />{k.label}
              </p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{loading ? '—' : k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
          <div className="relative flex-1 lg:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={tr("Search destination, driver, batch or vehicle…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tr("Search transports")}
              className="w-full h-9 pl-9 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={tr("Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700">
                <X size={14} />
              </button>
            )}
          </div>
          <div role="group" aria-label={tr("Filter by status")} className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1">
            {(['all', ...TRANSPORT_STATUSES] as StatusFilter[]).map((s) => {
              const active = statusFilter === s
              return (
                <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={active}
                  className={`flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    active ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {s === 'all' ? tr("All") : TRANSPORT_STATUS_META[s].label}
                  <span className={`tabular-nums ${active ? 'text-green-100' : 'text-gray-500'}`}>
                    {s === 'all' ? transports.length : count(s)}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="lg:ml-auto flex items-center gap-3">
            {filtersActive && (
              <button onClick={clearFilters} className="text-xs font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap">
                {tr("Clear filters")}
              </button>
            )}
            <TransportStatusGuide />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm">
              <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-3" />
              {tr("Loading transports…")}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <AlertTriangle size={30} className="text-gray-300 mb-2" />
              <p className="font-medium text-gray-800">{tr("Could not load transports")}</p>
              <p className="text-sm text-gray-500 mt-1">{loadError}</p>
              <button onClick={() => { setLoading(true); load() }} className={`${btnSecondary} mt-4 inline-flex items-center gap-1.5`}>
                <RefreshCw size={14} strokeWidth={1.75} /> {tr("Try again")}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <Truck size={34} strokeWidth={1.5} className="text-gray-300 mb-2" />
              {transports.length === 0 ? (
                <>
                  <p className="font-medium text-gray-800">{tr("No transports yet")}</p>
                  <p className="text-sm text-gray-500 mt-1">{tr("Schedule a delivery to start tracking it here.")}</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-800">{tr("No transports match these filters")}</p>
                  <button onClick={clearFilters} className="mt-2 text-sm font-medium text-green-800 hover:underline">{tr("Clear filters")}</button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      [tr("Batch"), ''], [tr("Destination"), 'w-[30%]'], [tr("Scheduled"), ''],
                      [tr("Cargo"), 'text-right'], [tr("Status"), ''], [tr("Actions"), 'text-right'],
                    ].map(([h, cls]) => (
                      <th key={h} className={`text-left px-4 py-3 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const next = NEXT_ACTION[t.status]
                    const lockedRow = isLockedDelivery(t)
                    return (
                      <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.harvest_id && t.batch_number ? (
                            <span className="font-bold text-gray-900 tabular-nums">{t.batch_number}</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{tr("Unlinked")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/transport/${t.id}`)} title={t.destination}
                            className="block max-w-[280px] truncate text-left font-medium text-gray-900 hover:text-green-800">
                            {t.destination}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap tabular-nums">{t.scheduled_date}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                          {t.cargo_weight_kg != null
                            ? <span className="font-semibold text-gray-900">{fmtKg(t.cargo_weight_kg)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3"><TransportStatusBadge status={t.status} /></td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {/* Fixed slot keeps the icon buttons aligned across rows */}
                            <div className="w-[92px] flex justify-end mr-1">
                              {next && <StatusPill action={next} onClick={() => setPending({ kind: 'status', transport: t, action: next })} />}
                            </div>
                            <IconButton icon={Eye} label={tr("View transport #{0}", t.id)} onClick={() => navigate(`/transport/${t.id}`)} />
                            <IconButton icon={Pencil} label={tr("Edit transport #{0}", t.id)} onClick={() => openEdit(t)} />
                            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
                            <IconButton icon={Trash2} label={tr("Delete transport #{0}", t.id)} danger
                              onClick={() => setPending({ kind: 'delete', transport: t })}
                              disabled={lockedRow}
                              disabledReason={tr("Delivered transports stay in their batch's history and cannot be deleted")} />
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
        {!loading && !loadError && filtersActive && filtered.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{tr("Showing")} {filtered.length} {tr("of")} {transports.length} {tr("transports")}</p>
        )}
      </div>

      {/* Create / edit */}
      <Dialog
        open={modalOpen}
        size="lg"
        title={editing ? tr("Edit Transport #{0}", editing.id) : tr("New Transport")}
        subtitle={editing ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {tr("Current status")} <TransportStatusBadge status={editing.status} />
            <span className="text-xs text-gray-500">{tr("Status changes use the Dispatch and Deliver actions.")}</span>
          </span>
        ) : tr("New deliveries start as Scheduled.")}
        onClose={() => setModal(false)}
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className={btnSecondary}>{tr("Cancel")}</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? tr("Saving…") : editing ? tr("Save Changes") : tr("Schedule Transport")}
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

          <FormSection step="A" title={tr("Delivery Information")} description={tr("Where the cargo goes, and which harvest it comes from.")}>
            <Field id="destination" label={tr("Destination")} required error={visibleError('destination')} className="sm:col-span-2">
              <input id="destination" type="text" value={form.destination} onChange={(e) => set({ destination: e.target.value })}
                placeholder={tr("e.g. Kuala Lumpur Market")} className={inputCls(visibleError('destination'))}
                aria-invalid={!!visibleError('destination')} />
            </Field>

            <Field id="harvest_id" label={tr("Harvest batch")} error={visibleError('harvest_id')} className="sm:col-span-2"
              hint={locked ? undefined : tr("Linking a batch reserves its stock. Choose “No batch linked” for external cargo.")}>
              <SearchableSelect id="harvest_id" value={form.harvest_id} disabled={locked} error={!!visibleError('harvest_id')}
                emptyOptionLabel={tr("No batch linked")} placeholder={tr("No batch linked")}
                searchPlaceholder={tr("Search batch number or field")} noResultsText={tr("No batches match")}
                onChange={(v) => {
                  const next = allocationFor({ ...form, harvest_id: v }, editing, harvests, summaries)
                  // Suggest the batch's remaining stock as the cargo weight when none was typed
                  set({
                    harvest_id: v,
                    cargo_weight_kg: form.cargo_weight_kg || (next?.maxKg ? String(next.maxKg) : ''),
                  })
                }}
                options={harvests.map((h) => {
                  const a = allocationFor({ ...form, harvest_id: String(h.id) }, editing, harvests, summaries)
                  const avail = h.harvest_status === 'rejected' ? tr("Rejected")
                    : a?.maxKg !== undefined ? `${fmtKg(a.maxKg)} available` : `${fmtKg(h.quantity_kg)} harvested`
                  return { value: String(h.id), label: h.batch_number, keywords: h.field_name, description: `${h.field_name} · ${avail}` }
                })} />
            </Field>

            {alloc && (
              <AllocationPanel alloc={alloc} weight={weightNum} locked={locked}
                onUseMax={() => set({ cargo_weight_kg: String(alloc.maxKg ?? '') })} />
            )}

            <Field id="cargo_weight_kg" label={tr("Cargo weight (kg)")} required={!!form.harvest_id && !locked}
              error={visibleError('cargo_weight_kg')}
              hint={locked ? tr("Locked after delivery.") : form.harvest_id ? undefined : tr("Optional for unlinked deliveries.")}>
              <input id="cargo_weight_kg" type="number" inputMode="decimal" min="0" step="0.1" disabled={locked}
                value={form.cargo_weight_kg} onChange={(e) => set({ cargo_weight_kg: e.target.value })}
                placeholder={form.harvest_id ? '' : tr("Optional")} className={inputCls(visibleError('cargo_weight_kg'))}
                aria-invalid={!!visibleError('cargo_weight_kg')} />
            </Field>

            <Field id="scheduled_date" label={tr("Scheduled date")} required error={visibleError('scheduled_date')}>
              <input id="scheduled_date" type="date" value={form.scheduled_date}
                onChange={(e) => set({ scheduled_date: e.target.value })} className={inputCls(visibleError('scheduled_date'))} />
            </Field>
          </FormSection>

          <FormSection step="B" title={tr("Driver and Vehicle")} description={tr("Who drives, and in which vehicle.")}>
            <Field id="driver_id" label={tr("Assign to worker")} className="sm:col-span-2"
              hint={tr("The assigned worker sees this delivery in their app and can update its status.")}>
              <SearchableSelect id="driver_id" value={form.driver_id}
                emptyOptionLabel={tr("Not assigned (external driver)")} placeholder={tr("Not assigned (external driver)")}
                searchPlaceholder={tr("Search workers")} noResultsText={tr("No workers match")}
                onChange={(v) => {
                  const worker = workers.find((w) => String(w.id) === v)
                  // Pre-fill the driver name from the chosen account; it stays editable
                  set({ driver_id: v, driver_name: worker ? (worker.full_name || worker.username) : form.driver_name })
                }}
                options={workers.map((w) => ({
                  value: String(w.id), label: w.full_name || w.username, keywords: w.username,
                  description: w.role === 'admin' ? tr("Admin") : tr("Worker"),
                }))} />
            </Field>
            <Field id="driver_name" label={tr("Driver name")} required error={visibleError('driver_name')}>
              <input id="driver_name" type="text" value={form.driver_name} onChange={(e) => set({ driver_name: e.target.value })}
                placeholder={tr("Driver full name")} className={inputCls(visibleError('driver_name'))} />
            </Field>
            <Field id="vehicle_number" label={tr("Vehicle number")} required error={visibleError('vehicle_number')}>
              <input id="vehicle_number" type="text" value={form.vehicle_number} onChange={(e) => set({ vehicle_number: e.target.value })}
                placeholder={tr("e.g. WXY 1234")} className={inputCls(visibleError('vehicle_number'))} />
            </Field>
          </FormSection>

          <FormSection step="C" title={tr("Additional Information")} description={tr("Anything the driver or team should know.")}>
            <Field id="notes" label={tr("Notes")} className="sm:col-span-2">
              <textarea id="notes" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })}
                placeholder={tr("Optional notes…")} className={`${inputCls()} resize-none`} />
            </Field>
          </FormSection>
        </div>
      </Dialog>

      {/* Status change / delete confirmation */}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'status' ? pending.action.confirmTitle : tr("Delete this transport?")}
        body={pending && (
          <>
            <p className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-800">
              <span className="font-medium">#{pending.transport.id} · {pending.transport.destination}</span>
              {pending.transport.batch_number && <span className="text-gray-600"> · {pending.transport.batch_number}</span>}
              {pending.transport.cargo_weight_kg != null && <span className="text-gray-600"> · {fmtKg(pending.transport.cargo_weight_kg)}</span>}
            </p>
            {pending.kind === 'status'
              ? pending.action.confirmBody
              : tr("The record is removed permanently. If it is linked to a batch, its reserved cargo is released. This cannot be undone.")}
          </>
        )}
        confirmLabel={pending?.kind === 'status' ? pending.action.confirmLabel : tr("Delete")}
        danger={pending?.kind === 'delete' || (pending?.kind === 'status' && pending.action.danger)}
        busy={busy}
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  )
}
