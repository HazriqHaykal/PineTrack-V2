import { useState } from 'react'
import { Truck, MapPin, Package, CheckCircle2, Clock, AlertCircle, ChevronDown } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'

type TransportStatus = 'pending' | 'in_transit' | 'delivered'

interface Transport {
  id: number
  batch_number: string
  destination: string
  vehicle_id: string
  status: TransportStatus
  quantity_kg: number
  scheduled_time: string
  driver_name: string
}

const DEMO_TRANSPORTS: Transport[] = [
  { id: 1, batch_number: 'PT-2024-001', destination: 'Cold Storage Unit 2', vehicle_id: 'VH-003', status: 'pending', quantity_kg: 150, scheduled_time: '10:30 AM', driver_name: 'You' },
  { id: 2, batch_number: 'PT-2024-002', destination: 'Processing Plant A', vehicle_id: 'VH-007', status: 'in_transit', quantity_kg: 200, scheduled_time: '09:00 AM', driver_name: 'You' },
  { id: 3, batch_number: 'PT-2024-003', destination: 'Market Dock 4',      vehicle_id: 'VH-001', status: 'delivered', quantity_kg: 180, scheduled_time: '08:00 AM', driver_name: 'You' },
]

const STATUS_CONFIG: Record<TransportStatus, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
  pending:    { label: 'Pending',    icon: <Clock size={15} />,        color: 'text-gray-500',  badge: 'bg-gray-100 text-gray-600'    },
  in_transit: { label: 'In Transit', icon: <Truck size={15} />,        color: 'text-blue-600',  badge: 'bg-blue-100 text-blue-700'    },
  delivered:  { label: 'Delivered',  icon: <CheckCircle2 size={15} />, color: 'text-green-600', badge: 'bg-green-100 text-green-700'  },
}

const NEXT_STATUS: Record<TransportStatus, TransportStatus | null> = {
  pending:    'in_transit',
  in_transit: 'delivered',
  delivered:  null,
}

const ACTION_LABEL: Record<TransportStatus, string> = {
  pending:    'Dispatch Now',
  in_transit: 'Mark Delivered',
  delivered:  '',
}

export default function TransportUpdate() {
  const [transports, setTransports] = useState<Transport[]>(DEMO_TRANSPORTS)
  const [expandedId, setExpandedId] = useState<number | null>(1)
  const [updating, setUpdating] = useState<number | null>(null)

  const updateStatus = async (id: number, current: TransportStatus) => {
    const next = NEXT_STATUS[current]
    if (!next) return
    setUpdating(id)
    await new Promise(r => setTimeout(r, 600))
    setTransports(prev => prev.map(t => t.id === id ? { ...t, status: next } : t))
    setUpdating(null)
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

        {/* Transport cards */}
        <div className="space-y-3">
          {transports.map(transport => {
            const s = STATUS_CONFIG[transport.status]
            const isExpanded = expandedId === transport.id
            const nextAction = NEXT_STATUS[transport.status]

            return (
              <div key={transport.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header */}
                <button
                  className="w-full p-4 flex items-center gap-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : transport.id)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    transport.status === 'in_transit' ? 'bg-blue-100' :
                    transport.status === 'delivered'  ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <span className={s.color}>{s.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900">{transport.batch_number}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
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
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{transport.vehicle_id}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Quantity</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{transport.quantity_kg} kg</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Scheduled</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{transport.scheduled_time}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Load</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Package size={13} className="text-gray-500" />
                          <p className="text-sm font-semibold text-gray-800">1 batch</p>
                        </div>
                      </div>
                    </div>

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
                            <AlertCircle size={15} className="animate-spin" /> Updating...
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

      </div>
    </WorkerLayout>
  )
}
