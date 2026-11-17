import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronRight, Loader2, MapPin, Package, Truck } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { EmptyState, ErrorNote, ICON_STROKE, StatTile, WorkerPage, cardCls, primaryBtn } from '../../components/worker/ui'
import { NEXT_ACTION, TRANSPORT_STATUS_META, TransportStatusBadge } from '../../components/transport/TransportStatus'
import { formatDay } from '../../components/schedule/taskMeta'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Transport } from '../../types'

import { tr } from '../../i18n'
type Status = Transport['status']
type Filter = 'all' | 'pending' | 'in_transit' | 'delivered'

/** Worker wording for the single forward step (the admin pages use the same workflow) */
const ACTION_LABEL: Partial<Record<Status, string>> = {
  pending: tr("Dispatch Now"),
  in_transit: tr("Mark Delivered"),
}

const kg = (n?: number | null) => (n != null ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : '—')

export default function TransportUpdate() {
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const load = async () => {
    try {
      const data = await apiClient.listTransports()
      setTransports(data.items)
      setError('')
      return data.items
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not load your deliveries.")))
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Open the first delivery that still needs action
    load().then(items => {
      const next = items.find(t => NEXT_ACTION[t.status])
      if (next) setExpandedId(next.id)
    })
  }, [])

  const updateStatus = async (t: Transport) => {
    const next = NEXT_ACTION[t.status]
    if (!next) return
    setUpdating(t.id)
    try {
      await apiClient.updateTransportStatus(t.id, next.to)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not update the delivery.")))
    } finally {
      setUpdating(null)
    }
  }

  const count = (s: Status) => transports.filter(t => t.status === s).length
  // Deliveries that need action first, then by date
  const order: Record<Status, number> = { in_transit: 0, pending: 1, delivered: 2, cancelled: 3 }
  const listed = transports
    .filter(t => filter === 'all' || t.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || a.scheduled_date.localeCompare(b.scheduled_date))

  const toggleFilter = (f: Filter) => setFilter(cur => (cur === f ? 'all' : f))

  return (
    <WorkerLayout>
      <WorkerPage title={tr("Deliveries")} subtitle={tr("Transport assigned to you")}>

        <div className="grid grid-cols-3 gap-3">
          {(['pending', 'in_transit', 'delivered'] as const).map(s => (
            <StatTile key={s} label={TRANSPORT_STATUS_META[s].label} dot={TRANSPORT_STATUS_META[s].dot}
              value={loading ? '—' : count(s)} active={filter === s} onClick={() => toggleFilter(s)} />
          ))}
        </div>
        {filter !== 'all' && (
          <p className="-mt-2 text-sm text-gray-600">
            {tr("Showing")} {TRANSPORT_STATUS_META[filter].label.toLowerCase()} {tr("only ·")}{' '}
            <button onClick={() => setFilter('all')} className="font-medium text-green-800 hover:underline">{tr("Show all")}</button>
          </p>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">{tr("Loading deliveries…")}</p>
        ) : transports.length === 0 ? (
          <EmptyState icon={Truck} title={tr("No deliveries assigned to you")}
            body={tr("Deliveries your supervisor assigns to you will appear here.")} />
        ) : listed.length === 0 ? (
          <EmptyState icon={Truck} title={tr("No {0} deliveries", TRANSPORT_STATUS_META[filter as Status].label.toLowerCase())}
            action={<button onClick={() => setFilter('all')} className="text-sm font-medium text-green-800 hover:underline">{tr("Show all deliveries")}</button>} />
        ) : (
          <ul className="space-y-3">
            {listed.map(t => {
              const isExpanded = expandedId === t.id
              const next = NEXT_ACTION[t.status]
              const NextIcon = next?.icon
              return (
                <li key={t.id} className={`${cardCls} overflow-hidden ${t.status === 'cancelled' ? 'opacity-70' : ''}`}>
                  <button
                    className="flex w-full items-start gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <MapPin size={18} strokeWidth={ICON_STROKE} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 break-words">{t.destination}</p>
                        <TransportStatusBadge status={t.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        <span className="font-medium text-gray-700 tabular-nums">{t.batch_number || tr("Delivery #{0}", t.id)}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{formatDay(t.scheduled_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        {t.cargo_weight_kg != null && <><span aria-hidden>·</span><span className="tabular-nums">{kg(t.cargo_weight_kg)}</span></>}
                      </p>
                    </div>
                    <ChevronDown size={18} className={`mt-1 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                        {[
                          [tr("Vehicle"), t.vehicle_number || '—', Truck],
                          [tr("Cargo"), kg(t.cargo_weight_kg), Package],
                          [tr("Scheduled"), formatDay(t.scheduled_date, { day: 'numeric', month: 'short', year: 'numeric' }), CalendarDays],
                          t.actual_delivery
                            ? [tr("Delivered"), formatDay(t.actual_delivery, { day: 'numeric', month: 'short', year: 'numeric' }), CalendarDays]
                            : [tr("Driver"), t.driver_name || '—', Truck],
                        ].map(([name, value, Icon]) => {
                          const I = Icon as typeof Truck
                          return (
                            <div key={name as string} className="min-w-0">
                              <dt className="flex items-center gap-1 text-xs text-gray-500"><I size={12} strokeWidth={ICON_STROKE} />{name as string}</dt>
                              <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{value as string}</dd>
                            </div>
                          )
                        })}
                      </dl>

                      {t.notes && <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">{t.notes}</p>}

                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                        <Link to={`/transport/${t.id}`}
                          className="inline-flex items-center justify-center gap-0.5 py-2 text-sm font-medium text-green-800 hover:underline sm:mr-auto">
                          {tr("View full details")} <ChevronRight size={15} />
                        </Link>
                        {next && NextIcon && (
                          <button onClick={() => updateStatus(t)} disabled={updating === t.id} className={`${primaryBtn} sm:min-w-[12rem]`}>
                            {updating === t.id
                              ? <><Loader2 size={16} className="animate-spin" /> {tr("Updating…")}</>
                              : <><NextIcon size={16} strokeWidth={2} /> {ACTION_LABEL[t.status]}</>}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </WorkerPage>
    </WorkerLayout>
  )
}
