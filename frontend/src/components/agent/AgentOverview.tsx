import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Info, RefreshCw } from 'lucide-react'
import { AIMetrics, AIRecommendation, AIRecommendations, AIStatus, FarmSnapshot } from '../../types'
import { PRIORITY_BADGE, REC_CATEGORY, SourceBadge, confidenceMeaning, formatWhen } from './agentMeta'

const ICON = { size: 16, strokeWidth: 1.75 } as const
// The rule engine used to emit this as a "recommendation"; older cached sets may still contain it
const LEGACY_NO_DATA_TITLE = 'No recent harvest data'

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}

/** What the agent was shown, so each recommendation can be checked against the numbers */
function FarmConditions({ s }: { s: FarmSnapshot }) {
  const navigate = useNavigate()
  const over = (v: number, max: number) => v > max
  const rows: { label: string; value: string; note?: string; warn?: boolean; path: string }[] = [
    { label: 'Harvest batches', value: `${s.harvest.batches}`, note: `${s.harvest.total_kg.toLocaleString()} kg`, path: '/harvest' },
    ...(s.harvest.batches > 0 ? [
      { label: 'Spoilage rate', value: `${s.harvest.spoilage_rate_percent}%`, note: `target ${s.targets.max_spoilage_rate_percent}%`,
        warn: over(s.harvest.spoilage_rate_percent, s.targets.max_spoilage_rate_percent), path: '/harvest' },
      { label: 'Rejection rate', value: `${s.harvest.rejection_rate_percent}%`, note: `target ${s.targets.max_rejection_rate_percent}%`,
        warn: over(s.harvest.rejection_rate_percent, s.targets.max_rejection_rate_percent), path: '/harvest' },
    ] : []),
    { label: 'Waste logged', value: `${s.waste.total_kg.toLocaleString()} kg`, note: `${s.waste.records} records`, path: '/waste' },
    { label: 'Overdue deliveries', value: `${s.transport.overdue_not_delivered.length}`, note: `${s.transport.in_transit} in transit`,
      warn: s.transport.overdue_not_delivered.length > 0, path: '/transport' },
    { label: 'Overdue tasks', value: `${s.tasks.overdue}`, note: `${s.tasks.open} open`, warn: s.tasks.overdue > 0, path: '/schedule' },
  ]
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-gray-900">Farm conditions</h2>
        <p className="text-xs text-gray-500 mt-0.5">What the agent looked at: last {s.period_days} days, up to {s.date}</p>
      </div>
      <ul className="border-t border-gray-100 divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.label}>
            <button onClick={() => navigate(r.path)}
              className="group flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50">
              <span className="flex-1 text-sm text-gray-700">{r.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${r.warn ? 'text-red-700' : 'text-gray-900'}`}>{r.value}</span>
              {r.note && <span className="w-24 text-right text-xs text-gray-500 tabular-nums">{r.note}</span>}
              <ChevronRight {...ICON} size={14} className="text-gray-300 group-hover:text-gray-500" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecommendationCard({ rec, source }: { rec: AIRecommendation; source: 'gemini' | 'rules' }) {
  const navigate = useNavigate()
  const cat = REC_CATEGORY[rec.type] ?? REC_CATEGORY.harvest
  const pri = PRIORITY_BADGE[rec.priority] ?? PRIORITY_BADGE.medium
  const Icon = cat.icon
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <Icon {...ICON} size={14} className="text-green-800" />{cat.label}
        </span>
        <span className={`inline-flex px-1.5 py-px rounded text-[11px] font-medium ring-1 ring-inset ${pri.cls}`}>{pri.label}</span>
      </div>
      <h3 className="mt-1.5 text-sm font-semibold text-gray-900">{rec.title}</h3>
      <p className="mt-0.5 text-sm text-gray-700 leading-relaxed">{rec.description}</p>
      {rec.impact && <p className="mt-1.5 text-xs text-gray-600"><span className="font-medium text-gray-700">Expected impact:</span> {rec.impact}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Navigation only; nothing is changed until the user acts in the module */}
        <button onClick={() => navigate(cat.path)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:border-green-700 hover:bg-green-50/50">
          {rec.action || `Open ${cat.module}`} <ChevronRight {...ICON} size={14} className="text-gray-400" />
        </button>
        <span className="text-xs text-gray-500">Opens {cat.module}</span>
        <details className="group w-full sm:w-auto sm:ml-auto text-xs">
          <summary className="cursor-pointer list-none text-gray-500 hover:text-gray-800 select-none">
            <span className="group-open:hidden">Details</span><span className="hidden group-open:inline">Hide details</span>
          </summary>
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 sm:max-w-sm">
            <p><span className="font-medium">Confidence {rec.confidence}%</span> · {source === 'gemini' ? 'from Gemini' : 'from built-in rules'}</p>
            <p className="mt-1 text-gray-600">{confidenceMeaning('recommendations', source)}</p>
          </div>
        </details>
      </div>
    </li>
  )
}

export default function AgentOverview({ status, recs, metrics, loading, refreshing, onRegenerate }: {
  status: AIStatus | null
  recs: AIRecommendations | null
  metrics: AIMetrics | null
  loading: boolean
  refreshing: boolean
  onRegenerate: () => void
}) {
  const navigate = useNavigate()
  const snapshot = recs?.snapshot ?? null
  const noHarvestData = snapshot ? snapshot.harvest.batches === 0 : false
  const items = (recs?.items ?? []).filter((r) => !(noHarvestData && r.title === LEGACY_NO_DATA_TITLE))
  const high = items.filter((r) => r.priority === 'high').length
  const fellBack = status?.gemini_configured && recs?.source === 'rules'

  return (
    <div className="space-y-4">
      {noHarvestData && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info {...ICON} className="shrink-0 mt-0.5 text-blue-700" />
          <div>
            <p className="font-medium">No recent harvest data available.</p>
            <p className="mt-0.5 text-blue-900/80">
              No harvests were recorded in the last {snapshot!.period_days} days, so recommendations about harvest quality and losses are limited until new batches are recorded.
              {' '}<button onClick={() => navigate('/harvest?new=1')} className="font-medium underline underline-offset-2 hover:no-underline">Record a harvest</button>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:max-w-xl">
        <Stat label="Active recommendations" value={loading ? '—' : items.length}
          sub={loading ? 'Loading…' : high ? `${high} high priority` : 'None high priority'} />
        <Stat label="Total predictions" value={metrics ? metrics.total_predictions.toLocaleString() : '—'} sub="All time, all agent tools" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Recommendations</h2>
              {recs && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <SourceBadge source={recs.source} model={recs.model_version} />
                  Generated {formatWhen(recs.generated_at)}
                </p>
              )}
            </div>
            <button onClick={onRegenerate} disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-medium disabled:opacity-60">
              <RefreshCw {...ICON} size={15} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
          {fellBack && (
            <p className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Gemini did not answer when this set was generated, so the built-in rules were used. Regenerate to try Gemini again.
            </p>
          )}
          {loading ? (
            <p className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">Analysing farm data…</p>
          ) : items.length === 0 ? (
            <div className="border-t border-gray-100 px-5 py-10 text-center">
              <p className="text-sm font-medium text-gray-800">No recommendations right now</p>
              <p className="mt-1 text-sm text-gray-500">
                {noHarvestData ? 'Nothing else in the recent records needs attention.' : 'Regenerate to analyse the latest farm records.'}
              </p>
            </div>
          ) : (
            <ul className="border-t border-gray-100 divide-y divide-gray-100">
              {items.map((rec) => <RecommendationCard key={rec.id} rec={rec} source={recs!.source} />)}
            </ul>
          )}
          <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-500">
            Recommendations are suggestions. Nothing is changed until you act on them in the relevant module.
          </p>
        </section>

        {snapshot ? <FarmConditions s={snapshot} /> : !loading && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-sm text-gray-500">
            Regenerate to see the farm conditions behind these recommendations.
          </section>
        )}
      </div>
    </div>
  )
}
