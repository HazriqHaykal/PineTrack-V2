import { useEffect, useState } from 'react'
import { Truck, MapPin, CheckCircle2, Clock, Loader2, ChevronDown, XCircle } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Transport } from '../../types'

type TransportStatus = Transport['status']

const STATUS_CONFIG: Record<TransportStatus, { label: string; icon: React.ReactNode; color: string; badge: string; tile: string }> = {
  pending:    { label: 'Pending',    icon: <Clock size={15} />,        color: 'text-gray-500',  badge: 'bg-gray-100 text-gray-600',   tile: 'bg-gray-100'  },
  in_transit: { label: 'In Transit', icon: <Truck size={15} />,        color: 'text-blue-600',  badge: 'bg-blue-100 text-blue-700',   tile: 'bg-blue-100'  },
  delivered:  { label: 'Delivered',  icon: <CheckCircle2 size={15} />, color: 'text-green-600', badge: 'bg-green-100 text-green-700', tile: 'bg-green-100' },
  cancelled:  { label: 'Cancelled',  icon: <XCircle size={15} />,      color: 'text-red-500',   badge: 'bg-red-100 text-red-700',     tile: 'bg-red-50'    },
}

const NEXT_STATUS: Record<TransportStatus, TransportStatus | null> = {
  pending:    'in_transit',
  in_transit: 'delivered',
  delivered:  null,
  cancelled:  null,
}

const ACTION_LABEL: Record<TransportStatus, string> = {
  pending:    'Dispatch Now',
  in_transit: 'Mark Delivered',
  delivered:  '',
  cancelled:  '',
}

export default function TransportUpdate() {
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)

  const load = async () => {
    try {
      const data = await apiClient.listTransports()
      setTransports(data.items)
      setError('')
      return data.items
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your deliveries.'))
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Open the first delivery that still needs action
    load().then(items => {
      const next = items.find(t => NEXT_STATUS[t.status])
      if (next) setExpandedId(next.id)
    })
  }, [])

  const updateStatus = async (id: number, current: TransportStatus) => {
    const next = NEXT_STATUS[current]
    if (!next) return
    setUpdating(id)
    try {
      await apiClient.updateTransportStatus(id, next)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the delivery.'))
    } finally {
      setUpdating(null)
    }
  }

  const pending   = transports.filter(t => t.status === 'pending').length
  const inTransit = transports.filter(t => t.status === 'in_transit').length
  const delivered = transports.filter(t => t.status === 'delivered').length

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Truck size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Transport Updates</h1>
            <p className="text-xs text-gray-500">Manage your assigned deliveries</p>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-700">{pending}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Pending</p>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-700">{inTransit}</p>
            <p className="text-[10px] text-blue-500 uppercase tracking-wide mt-0.5">In Transit</p>
          </div>
          <div className="bg-green-50 rounded-2xl border border-green-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-700">{delivered}</p>
            <p className="text-[10px] text-green-500 uppercase tracking-wide mt-0.5">Delivered</p>
          </div>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">{error}</p>
        )}

        {/* Transport cards */}
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading deliveries…</p>
        ) : transports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Truck size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">No deliveries assigned to you</p>
            <p className="text-xs text-gray-400 mt-1">Deliveries your supervisor assigns to you will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transports.map(transport => {
              const s = STATUS_CONFIG[transport.status] ?? STATUS_CONFIG.pending
              const isExpanded = expandedId === transport.id
              const nextAction = NEXT_STATUS[transport.status]

              return (
                <div key={transport.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : transport.id)}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.tile}`}>
                      <span className={s.color}>{s.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {transport.batch_number || `Delivery #${transport.id}`}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-gray-400" />
                        <p className="text-xs text-gray-500 truncate">{transport.destination}</p>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Vehicle</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{transport.vehicle_number || '—'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cargo</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                            {transport.cargo_weight_kg ? `${transport.cargo_weight_kg} kg` : '—'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Scheduled</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{transport.scheduled_date}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                            {transport.actual_delivery ? 'Delivered' : 'Driver'}
                          </p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
                            {transport.actual_delivery || transport.driver_name || '—'}
                          </p>
                        </div>
                      </div>

                      {transport.notes && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">{transport.notes}</p>
                      )}

                      {nextAction && (
                        <button
                          onClick={() => updateStatus(transport.id, transport.status)}
                          disabled={updating === transport.id}
                          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 ${
                            transport.status === 'pending'
                              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-100'
                          }`}
                        >
                          {updating === transport.id ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 size={15} className="animate-spin" /> Updating...
                            </span>
                          ) : ACTION_LABEL[transport.status]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </WorkerLayout>
  )
}
