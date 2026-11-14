import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Recycle, Plus } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { EmptyState, ErrorNote, Segmented, StatTile, WorkerPage, cardCls, primaryBtn } from '../../components/worker/ui'
import { apiClient, apiErrorMessage } from '../../services/api'
import GradeBadge, { GRADES, GRADE_META } from '../../components/batch/GradeBadge'
import { Harvest, Waste } from '../../types'

type Tab = 'harvest' | 'waste'

/** Grading status, same semantic colours as task and transport badges */
const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-800 ring-amber-200',
  graded:    'bg-blue-50 text-blue-800 ring-blue-200',
  processed: 'bg-green-50 text-green-800 ring-green-200',
  rejected:  'bg-red-50 text-red-800 ring-red-200',
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
      <WorkerPage title="My Records" subtitle="Everything you have logged">

        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Harvested" value={`${totalHarvestKg.toLocaleString()} kg`} sub={`${harvests.length} batches`} dot="bg-green-600" />
          <StatTile label="Waste logged" value={`${totalWasteKg.toLocaleString()} kg`} sub={`${waste.length} entries`} dot="bg-gray-400" />
        </div>

        <Segmented<Tab> label="Record type" value={tab} onChange={setTab} options={[
          { value: 'harvest', label: 'Harvests', count: harvests.length },
          { value: 'waste', label: 'Waste', count: waste.length },
        ]} />

        {error && <ErrorNote>{error}</ErrorNote>}

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading records…</p>
        ) : tab === 'harvest' ? (
          harvests.length === 0 ? (
            <Empty icon={Sprout} text="No harvests logged yet" action="Log a harvest" onClick={() => navigate('/harvest-entry')} />
          ) : (
            <div className="space-y-2">
              {harvests.map(h => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/harvest/${h.id}`)}
                  className={`${cardCls} block w-full text-left p-4 hover:border-green-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 font-mono">{h.batch_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{h.field_name} · {h.harvest_date}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">{h.quantity_kg} kg</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <GradeBadge grade={h.quality_grade} />
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset capitalize ${STATUS_BADGE[h.harvest_status] ?? STATUS_BADGE.pending}`}>
                      {h.harvest_status}
                    </span>
                    {h.grading_basis === 'ungraded' ? (
                      <span className="text-[11px] text-amber-800">Grades not recorded yet</span>
                    ) : (
                      <span className="text-[11px] text-gray-600 tabular-nums">
                        {h.marketable_yield_kg.toLocaleString()} kg marketable ({h.marketable_yield_percent}%)
                        {h.grading_basis === 'legacy' && ' · legacy'}
                      </span>
                    )}
                  </div>
                  {h.grade_quantities && (
                    <div className="mt-2">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
                        {GRADES.filter(g => h.grade_quantities![g] > 0).map(g => (
                          <span key={g} className={GRADE_META[g].dot} style={{ width: `${(h.grade_quantities![g] / h.quantity_kg) * 100}%` }} />
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500 tabular-nums">
                        {GRADES.map(g => `${g} ${h.grade_quantities![g].toLocaleString()} kg`).join(' · ')}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )
        ) : waste.length === 0 ? (
          <Empty icon={Recycle} text="No waste logged yet" action="Log waste" onClick={() => navigate('/waste-submit')} />
        ) : (
          <div className="space-y-2">
            {waste.map(w => (
              <div key={w.id} className={`${cardCls} p-4`}>
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
                  <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-200 capitalize">
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

      </WorkerPage>
    </WorkerLayout>
  )
}

function Empty({ icon, text, action, onClick }: { icon: React.ElementType; text: string; action: string; onClick: () => void }) {
  return (
    <EmptyState icon={icon} title={text} action={
      <button onClick={onClick} className={`${primaryBtn} py-2`}><Plus size={15} /> {action}</button>
    } />
  )
}
