import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, Check, History, Info, Pencil, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import AdminLayout from '../components/layout/AdminLayout'
import WorkerLayout from '../components/layout/WorkerLayout'
import { ConfirmDialog, btnSecondary } from '../components/ui/Dialog'
import { eventInfo } from '../components/batch/eventInfo'
import {
  NEXT_ACTION, SIDE_ACTIONS, StatusAction, TRANSPORT_STATUS_META, TransportStatus, TransportStatusBadge, isLockedDelivery,
} from '../components/transport/TransportStatus'
import { apiClient, apiErrorMessage } from '../services/api'
import { authService } from '../services/auth'
import { BatchEvent, Transport } from '../types'

import { tr, locale } from '../i18n'
const fmtKg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type HistoryState =
  | { state: 'unlinked' }
  | { state: 'loading' }
  | { state: 'error'; msg: string }
  | { state: 'denied' }
  | { state: 'ready'; items: BatchEvent[]; complete: boolean; note?: string | null }

// ── Stepper ──────────────────────────────────────────────────────────────────

const FLOW: TransportStatus[] = ['pending', 'in_transit', 'delivered']

function DeliveryStepper({ t, dispatchedAt }: { t: Transport; dispatchedAt?: string }) {
  const cancelled = t.status === 'cancelled'
  const currentIdx = FLOW.indexOf(t.status)
  // Only dates the backend actually stores, or that the event log recorded
  const dates: Record<string, string | undefined> = {
    pending: tr("Planned {0}", fmtDate(t.scheduled_date)),
    in_transit: dispatchedAt ? tr("Dispatched {0}", fmtTime(dispatchedAt)) : undefined,
    delivered: t.actual_delivery ? tr("Delivered {0}", fmtDate(t.actual_delivery)) : undefined,
  }

  return (
    <div>
      <ol className={`flex items-start ${cancelled ? 'opacity-50' : ''}`} aria-label={tr("Delivery progress")}>
        {FLOW.map((s, i) => {
          const done = !cancelled && (i < currentIdx || (i === currentIdx && s === 'delivered'))
          const current = !cancelled && i === currentIdx
          return (
            <li key={s} className="relative flex flex-1 flex-col items-center text-center min-w-0" aria-current={current ? 'step' : undefined}>
              {i > 0 && (
                <span aria-hidden className={`absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                  !cancelled && i <= currentIdx ? 'bg-green-700' : 'bg-gray-200'
                }`} />
              )}
              <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                done ? 'bg-green-700 text-white' + (current ? ' ring-4 ring-green-100' : '')
                : current ? 'bg-green-700 text-white ring-4 ring-green-100'
                : 'bg-white text-gray-500 border border-gray-300'
              }`}>
                {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={`mt-2 px-1 text-xs leading-tight ${current ? 'font-semibold text-gray-900' : done ? 'text-gray-800' : 'text-gray-500'}`}>
                {TRANSPORT_STATUS_META[s].label}
              </span>
              {dates[s] && (i <= currentIdx || cancelled) && (
                <span className="mt-0.5 px-1 text-[11px] leading-tight text-gray-500">{dates[s]}</span>
              )}
            </li>
          )
        })}
      </ol>
      {cancelled && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <Ban size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
          <span><span className="font-semibold">{tr("Cancelled.")}</span> {tr("This delivery was called off and its cargo no longer counts against any batch.")}</span>
        </p>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TransportDetails() {
  const { transportId } = useParams()
  const navigate = useNavigate()
  const isAdmin = authService.isAdmin()
  const id = Number(transportId)

  const [t, setT] = useState<Transport | null>(null)
  const [error, setError] = useState<{ status?: number; msg: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryState>({ state: 'loading' })
  const [pending, setPending] = useState<{ kind: 'status'; action: StatusAction } | { kind: 'delete' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError({ status: 404, msg: tr("Transport not found") })
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await apiClient.getTransport(id)
      setT(data)
      setError(null)
      if (!data.harvest_id) {
        setHistory({ state: 'unlinked' })
      } else {
        setHistory({ state: 'loading' })
        // Transport history is recorded on the linked batch's event log
        apiClient.getBatchEvents(data.harvest_id)
          .then((res) => setHistory({
            state: 'ready',
            items: res.items.filter((e) => e.related_module === 'transport' && e.related_record_id === data.id),
            complete: res.history_complete,
            note: res.history_note,
          }))
          .catch((err) => {
            // Assigned drivers may not have access to the batch itself
            const status = (err as { response?: { status?: number } })?.response?.status
            setHistory(status === 403 ? { state: 'denied' } : { state: 'error', msg: apiErrorMessage(err, tr("Could not load the history")) })
          })
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError({ status, msg: apiErrorMessage(err, tr("Failed to load the transport")) })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const confirm = async () => {
    if (!t || !pending) return
    setBusy(true)
    setActionError(null)
    try {
      if (pending.kind === 'delete') {
        await apiClient.deleteTransport(t.id)
        navigate('/transport', { replace: true })
        return
      }
      await apiClient.updateTransportStatus(t.id, pending.action.to)
      setPending(null)
      load()
    } catch (err) {
      setPending(null)
      setActionError(apiErrorMessage(err, tr("The change could not be saved")))
    } finally {
      setBusy(false)
    }
  }

  const Layout = isAdmin ? AdminLayout : WorkerLayout
  const backPath = isAdmin ? '/transport' : '/transport-update'

  let body: React.ReactNode
  if (loading && !t) {
    body = (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-sm">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-3" />
        {tr("Loading transport…")}
      </div>
    )
  } else if (error && !t) {
    const denied = error.status === 403
    body = (
      <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-xl border border-gray-100 shadow-sm px-4">
        {denied ? <ShieldAlert size={36} className="text-gray-300 mb-2" /> : <AlertTriangle size={36} className="text-gray-300 mb-2" />}
        <p className="font-medium text-gray-800">
          {denied ? tr("You do not have access to this transport") : error.status === 404 ? tr("Transport not found") : tr("Could not load this transport")}
        </p>
        <p className="text-sm text-gray-500 mt-1">{error.msg}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate(backPath)} className={btnSecondary}>{tr("Back")}</button>
          {!denied && error.status !== 404 && (
            <button onClick={load} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium">{tr("Try again")}</button>
          )}
        </div>
      </div>
    )
  } else if (t) {
    const next = NEXT_ACTION[t.status]
    // Workers reach this page only for deliveries they created or drive, so the forward step is theirs to take
    const side = isAdmin ? SIDE_ACTIONS[t.status] : []
    const locked = isLockedDelivery(t)
    const dispatchedAt = history.state === 'ready'
      ? history.items.filter((e) => e.event_type === 'transport_dispatched').map((e) => e.created_at).sort().pop()
      : undefined

    const facts: [string, React.ReactNode][] = [
      [tr("Harvest batch"), t.harvest_id && history.state === 'denied'
        ? <>{t.batch_number ?? tr("Batch #{0}", t.harvest_id)}</>
        : t.harvest_id
        ? <Link to={`/harvest/${t.harvest_id}`} className="text-green-800 hover:underline">{t.batch_number ?? tr("Batch #{0}", t.harvest_id)}</Link>
        : <span className="text-gray-500">{tr("Unlinked (external cargo)")}</span>],
      [tr("Driver"), <>{t.driver_name || '—'}<span className="block text-xs font-normal text-gray-500">{t.driver_id ? tr("Assigned worker account") : tr("External driver")}</span></>],
      [tr("Vehicle number"), t.vehicle_number || '—'],
      [tr("Cargo weight"), t.cargo_weight_kg != null ? fmtKg(t.cargo_weight_kg) : <span className="text-gray-500">{tr("Not recorded")}</span>],
      [tr("Scheduled date"), fmtDate(t.scheduled_date)],
      [tr("Actual delivery"), t.actual_delivery ? fmtDate(t.actual_delivery) : <span className="text-gray-500">{tr("Not delivered yet")}</span>],
      [tr("Created"), fmtTime(t.created_at)],
      [tr("Last updated"), t.updated_at ? fmtTime(t.updated_at) : '—'],
    ]

    body = (
      <div className="space-y-5">
        {/* Header */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 tabular-nums">{tr("Transport #")}{t.id}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h1 className="text-2xl font-bold text-gray-900 break-words mr-1">{t.destination}</h1>
                <TransportStatusBadge status={t.status} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {next && (
                <button onClick={() => setPending({ kind: 'status', action: next })}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${next.pill}`}>
                  <next.icon size={15} strokeWidth={1.75} /> {next.confirmLabel}
                </button>
              )}
              {side.map((a) => (
                <button key={a.to} onClick={() => setPending({ kind: 'status', action: a })}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${a.pill}`}>
                  <a.icon size={15} strokeWidth={1.75} /> {a.label}
                </button>
              ))}
              {isAdmin && (
                <>
                  <button onClick={() => navigate(`/transport?edit=${t.id}`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Pencil size={15} strokeWidth={1.75} /> {tr("Edit")}
                  </button>
                  <button onClick={() => setPending({ kind: 'delete' })} disabled={locked}
                    title={locked ? tr("Delivered transports stay in their batch's history and cannot be deleted") : tr("Delete transport")}
                    aria-label={tr("Delete transport")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500 disabled:hover:border-gray-200">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </>
              )}
              <button onClick={load} disabled={loading} aria-label={tr("Refresh")} title={tr("Refresh")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-60">
                <RefreshCw size={15} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <DeliveryStepper t={t} dispatchedAt={dispatchedAt} />
          </div>
        </section>

        {actionError && (
          <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />{actionError}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Facts */}
          <section className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{tr("Delivery details")}</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {facts.map(([name, value]) => (
                <div key={name} className="min-w-0">
                  <dt className="text-xs text-gray-500">{name}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">{tr("Notes")}</p>
              {t.notes
                ? <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">{t.notes}</p>
                : <p className="mt-1 text-sm text-gray-500">{tr("No notes.")}</p>}
            </div>
          </section>

          {/* History */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{tr("History")}</h2>
            {history.state === 'unlinked' ? (
              <p className="flex gap-2 text-sm text-gray-600">
                <Info size={15} className="shrink-0 mt-0.5 text-gray-400" />
                {tr("History is recorded on harvest batches. This delivery is not linked to one, so only its current status and dates are shown.")}
              </p>
            ) : history.state === 'loading' ? (
              <p className="text-sm text-gray-500">{tr("Loading history…")}</p>
            ) : history.state === 'denied' ? (
              <p className="flex gap-2 text-sm text-gray-600">
                <Info size={15} className="shrink-0 mt-0.5 text-gray-400" />
                {tr("History is kept on the harvest batch, which is managed by another user. The current status and dates are shown above.")}
              </p>
            ) : history.state === 'error' ? (
              <p className="text-sm text-gray-600">{history.msg}</p>
            ) : history.items.length === 0 ? (
              <p className="flex gap-2 text-sm text-gray-600">
                <History size={15} className="shrink-0 mt-0.5 text-gray-400" />
                {tr("No events are recorded for this delivery on")} {t.batch_number ?? tr("its batch")}.
              </p>
            ) : (
              <ol className="relative space-y-4">
                <span className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" aria-hidden />
                {history.items.map((e) => {
                  const info = eventInfo(e.event_type)
                  const Icon = info.icon
                  return (
                    <li key={e.id} className="relative flex gap-3">
                      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${info.tone}`}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="font-semibold text-sm text-gray-900">{info.title}</p>
                        <p className="text-sm text-gray-700 mt-0.5 break-words">{e.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <time dateTime={e.created_at}>{fmtTime(e.created_at)}</time> · {e.actor_name}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {history.state === 'ready' && (
              <p className="mt-4 text-xs text-gray-500">
                {tr("From the event log of")} {t.batch_number ?? tr("the linked batch")}{tr(". Events recorded while this delivery was linked to a different batch appear on that batch.")}
                {!history.complete && history.note ? ` ${history.note}` : ''}
              </p>
            )}
          </section>
        </div>

        <ConfirmDialog
          open={pending !== null}
          title={pending?.kind === 'status' ? pending.action.confirmTitle : tr("Delete this transport?")}
          body={pending?.kind === 'status'
            ? pending.action.confirmBody
            : tr("The record is removed permanently. If it is linked to a batch, its reserved cargo is released. This cannot be undone.")}
          confirmLabel={pending?.kind === 'status' ? pending.action.confirmLabel : tr("Delete")}
          danger={pending?.kind === 'delete' || (pending?.kind === 'status' && pending.action.danger)}
          busy={busy}
          onConfirm={confirm}
          onClose={() => setPending(null)}
        />
      </div>
    )
  }

  return (
    <Layout>
      <div className={`${isAdmin ? '' : 'p-4 sm:p-6 lg:p-8 '}max-w-5xl`}>
        <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft size={15} /> {isAdmin ? tr("Transport Management") : tr("Transport Updates")}
        </button>
        {body}
      </div>
    </Layout>
  )
}
