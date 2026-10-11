import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Sprout, Recycle, Plus } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Harvest, Waste } from '../../types'

type Tab = 'harvest' | 'waste'

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-red-100 text-red-800',
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  graded:    'bg-blue-100 text-blue-700',
  processed: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
}

export default function MyRecords() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('harvest')
  const [harvests, setHarvests] = useState<Harvest[]>([])
  const [waste, setWaste] = useState<Waste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // For a worker these endpoints return only their own records
    Promise.all([apiClient.listHarvests(0, 200), apiClient.listWaste(0, 200)])
      .then(([h, w]) => { setHarvests(h.items); setWaste(w.items) })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your records.')))
      .finally(() => setLoading(false))
  }, [])

  const totalHarvestKg = harvests.reduce((sum, h) => sum + h.quantity_kg, 0)
  const totalWasteKg   = waste.reduce((sum, w) => sum + w.quantity_kg, 0)

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <ClipboardList size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Records</h1>
            <p className="text-xs text-gray-500">Everything you have logged</p>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-2xl border border-green-100 p-3 shadow-sm">
            <p className="text-2xl font-bold text-green-700">{totalHarvestKg.toLocaleString()} kg</p>
            <p className="text-[10px] text-green-600 uppercase tracking-wide mt-0.5">{harvests.length} harvest batches</p>
          </div>
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-3 shadow-sm">
            <p className="text-2xl font-bold text-orange-600">{totalWasteKg.toLocaleString()} kg</p>
            <p className="text-[10px] text-orange-500 uppercase tracking-wide mt-0.5">{waste.length} waste entries</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {([['harvest', 'Harvests'], ['waste', 'Waste']] as [Tab, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">{error}</p>
        )}

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading records…</p>
        ) : tab === 'harvest' ? (
          harvests.length === 0 ? (
            <Empty icon={<Sprout size={28} />} text="No harvests logged yet" action="Log a harvest" onClick={() => navigate('/harvest-entry')} />
          ) : (
            <div className="space-y-2">
              {harvests.map(h => (
                <div key={h.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 font-mono">{h.batch_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{h.field_name} · {h.harvest_date}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">{h.quantity_kg} kg</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GRADE_BADGE[h.quality_grade] ?? 'bg-gray-100 text-gray-600'}`}>
                      {GRADE_BADGE[h.quality_grade] ? `Grade ${h.quality_grade}` : 'Ungraded'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[h.harvest_status] ?? STATUS_BADGE.pending}`}>
                      {h.harvest_status}
                    </span>
                    {(h.spoilage_kg > 0 || h.rejected_kg > 0) && (
                      <span className="text-[10px] text-gray-500">
                        {h.marketable_yield_kg} kg marketable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : waste.length === 0 ? (
          <Empty icon={<Recycle size={28} />} text="No waste logged yet" action="Log waste" onClick={() => navigate('/waste-submit')} />
        ) : (
          <div className="space-y-2">
            {waste.map(w => (
              <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 capitalize">{w.waste_type.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {w.waste_date}{w.batch_number ? ` · from ${w.batch_number}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{w.quantity_kg} kg</p>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 capitalize">
                    {w.classification.replace('-', ' ')}
                  </span>
                  {w.disposal_method && (
                    <span className="text-[10px] text-gray-500 capitalize">{w.disposal_method}</span>
                  )}
                </div>
                {w.notes && <p className="text-xs text-gray-500 mt-2">{w.notes}</p>}
              </div>
            ))}
          </div>
        )}

      </div>
    </WorkerLayout>
  )
}

function Empty({ icon, text, action, onClick }: { icon: React.ReactNode; text: string; action: string; onClick: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="text-gray-300 flex justify-center mb-2">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
      <button
        onClick={onClick}
        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors"
      >
        <Plus size={13} /> {action}
      </button>
    </div>
  )
}
