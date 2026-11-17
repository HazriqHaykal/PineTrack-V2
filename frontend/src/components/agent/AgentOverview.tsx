import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Info, RefreshCw } from 'lucide-react'
import { AIRecommendation, AIRecommendations, AIStatus, AnalysisScope, FarmSnapshot, SulurSnapshot } from '../../types'
import { scopeLabel } from '../ui/ModuleScope'
import { PRIORITY_BADGE, REC_CATEGORY, SourceBadge, confidenceMeaning, formatWhen } from './agentMeta'

import { tr } from '../../i18n'
const ICON = { size: 16, strokeWidth: 1.75 } as const
// The rule engine used to emit this as a "recommendation"; older cached sets may still contain it
const LEGACY_NO_DATA_TITLE = 'No recent harvest data'

/** One line of farm data the agent was given, linking to the module it came from */
interface DataRow { label: string; value: string; note?: string; warn?: boolean; path: string }

function DataList({ title, caption, rows }: { title: string; caption: string; rows: DataRow[] }) {
  const navigate = useNavigate()
  return (
    <div>
      <p className="px-5 pt-3 text-xs font-semibold text-gray-800">{title}</p>
      <p className="px-5 text-[11px] text-gray-500">{caption}</p>
      <ul className="mt-1.5 divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.label}>
            <button onClick={() => navigate(r.path)} className="group flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-gray-50">
              <span className="flex-1 text-sm text-gray-700">{r.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${r.warn ? 'text-red-700' : 'text-gray-900'}`}>{r.value}</span>
              {r.note && <span className="w-28 truncate text-right text-xs text-gray-500" title={r.note}>{r.note}</span>}
              <ChevronRight {...ICON} size={14} className="text-gray-300 group-hover:text-gray-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function farmRows(s: FarmSnapshot): DataRow[] {
  return [
    { label: tr("Harvest batches"), value: `${s.harvest.batches}`, note: `${s.harvest.total_kg.toLocaleString()} kg`, path: '/harvest' },
    ...(s.harvest.batches > 0 ? [
      { label: tr("Spoilage rate"), value: `${s.harvest.spoilage_rate_percent}%`, note: tr("target {0}%", s.targets.max_spoilage_rate_percent),
        warn: s.harvest.spoilage_rate_percent > s.targets.max_spoilage_rate_percent, path: '/harvest' },
      { label: tr("Rejection rate"), value: `${s.harvest.rejection_rate_percent}%`, note: tr("target {0}%", s.targets.max_rejection_rate_percent),
        warn: s.harvest.rejection_rate_percent > s.targets.max_rejection_rate_percent, path: '/harvest' },
    ] : []),
    { label: tr("Waste logged"), value: `${s.waste.total_kg.toLocaleString()} kg`, note: tr("{0} records", s.waste.records), path: '/waste' },
    { label: tr("Overdue deliveries"), value: `${s.transport.overdue_not_delivered.length}`, note: tr("{0} in transit", s.transport.in_transit),
      warn: s.transport.overdue_not_delivered.length > 0, path: '/transport' },
    { label: tr("Overdue tasks"), value: `${s.tasks.overdue}`, note: tr("{0} open", s.tasks.open), warn: s.tasks.overdue > 0, path: '/schedule' },
  ]
}

function sulurRows(s: SulurSnapshot): DataRow[] {
  const below = s.by_variety.filter((v) => v.below_threshold)
  return [
    { label: tr("Sulur batches"), value: `${s.batches}`, note: tr("{0} certified", s.certified_batches), path: '/admin/sulur/stock' },
    { label: tr("Available sulur"), value: s.totals.available.toLocaleString(), note: tr("{0} reserved", s.totals.reserved.toLocaleString()), path: '/admin/sulur/stock' },
    { label: tr("Varieties below minimum"), value: `${below.length}`, note: below.map((v) => v.variety).join(', ') || undefined,
      warn: below.length > 0, path: '/admin/sulur/stock' },
    { label: tr("Stored over {0} days untreated", s.storage_days_limit), value: `${s.aging_batches.length}`,
      warn: s.aging_batches.length > 0, path: '/admin/sulur/stock' },
    { label: tr("Awaiting certification"), value: `${s.uncertified_count}`, path: '/admin/sulur/stock' },
  ]
}

/** One recommendation: short by default, the reasoning on request */
function RecommendationCard({ rec, source }: { rec: AIRecommendation; source: 'gemini' | 'rules' }) {
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
      {/* Two lines by default; the full text is under "Why this recommendation?" */}
      <p className="mt-0.5 text-sm text-gray-700 leading-relaxed line-clamp-2">{rec.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Navigation only; nothing is changed until the user acts in the module */}
        <Link to={cat.path}
          className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:border-green-700 hover:bg-green-50/50">
          {rec.action || tr("Open {0}", cat.module)} <ChevronRight {...ICON} size={14} className="text-gray-400" />
        </Link>
        <details className="group w-full text-xs">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-gray-600 hover:text-gray-900 select-none">
            {tr("Why this recommendation?")}
            <ChevronDown {...ICON} size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-700">
            <p className="text-sm leading-relaxed">{rec.description}</p>
            {rec.impact && <p><span className="font-medium">{tr("Expected impact:")}</span> {rec.impact}</p>}
            <p className="text-gray-600">
              <span className="font-medium text-gray-700">{tr("Confidence")} {rec.confidence}%</span>
              {' · '}{source === 'gemini' ? tr("from Gemini") : tr("from built-in rules")}. {confidenceMeaning('recommendations', source)}
            </p>
            <p className="text-gray-600">{tr("Opens {0}. Nothing changes until you act there.", cat.module)}</p>
          </div>
        </details>
      </div>
    </li>
  )
}

/** Recommendations for the selected module, plus the farm data they were based on */
export default function AgentOverview({ scope, status, recs, loading, refreshing, onRegenerate }: {
  scope: AnalysisScope
  status: AIStatus | null
  recs: AIRecommendations | null
  loading: boolean
  refreshing: boolean
  onRegenerate: () => void
}) {
  const snapshot = recs?.snapshot ?? null
  // A Sulur-only set has no post-harvest section; a post-harvest set has no Sulur section
  const farm: FarmSnapshot | null = snapshot && 'harvest' in snapshot ? snapshot : null
  const sulur: SulurSnapshot | null = snapshot?.sulur ?? null
  const noHarvestData = farm ? farm.harvest.batches === 0 : false
  const noSulurData = sulur ? sulur.batches === 0 : false
  const items = (recs?.items ?? []).filter((r) => !(noHarvestData && r.title === LEGACY_NO_DATA_TITLE))
  const fellBack = status?.gemini_configured && recs?.source === 'rules'

  return (
    <section aria-labelledby="recs-heading" className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id="recs-heading" className="text-base font-semibold text-gray-900">{tr("Recommendations")}</h2>
          {recs && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <SourceBadge source={recs.source} model={recs.model_version} />
              {scopeLabel(recs.scope ?? scope)} · {tr("Generated")} {formatWhen(recs.generated_at)}
            </p>
          )}
        </div>
        <button onClick={onRegenerate} disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw {...ICON} size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? tr("Generating…") : tr("Regenerate")}
        </button>
      </div>

      {/* Compact notices: one line each, with the place to fix it */}
      {(fellBack || noHarvestData || noSulurData) && (
        <div className="space-y-1.5 px-5 pb-3">
          {fellBack && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              {tr("Gemini did not answer when this set was generated, so the built-in rules were used. Regenerate to try Gemini again.")}
            </p>
          )}
          {noHarvestData && (
            <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-900">
              <Info {...ICON} size={14} className="shrink-0 text-blue-700" />
              <span>{tr("No harvests in the last {0} days, so harvest advice is limited.", farm!.period_days)}{' '}
                <Link to="/harvest?new=1" className="font-medium underline underline-offset-2 hover:no-underline">{tr("Record a harvest")}</Link></span>
            </p>
          )}
          {noSulurData && (
            <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-900">
              <Info {...ICON} size={14} className="shrink-0 text-blue-700" />
              <span>{tr("No Sulur batches recorded yet, so there is no Sulur advice.")}{' '}
                <Link to="/admin/sulur/stock" className="font-medium underline underline-offset-2 hover:no-underline">{tr("Add Sulur batches")}</Link></span>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">{tr("Analysing")} {scopeLabel(scope)} {tr("data…")}</p>
      ) : items.length === 0 ? (
        <div className="border-t border-gray-100 px-5 py-8 text-center">
          <p className="text-sm font-medium text-gray-800">{tr("No recommendations right now")}</p>
          <p className="mt-1 text-sm text-gray-500">
            {noHarvestData || noSulurData ? tr("Nothing else in the recorded data needs attention.") : tr("Regenerate to analyse the latest records.")}
          </p>
        </div>
      ) : (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {items.map((rec) => <RecommendationCard key={rec.id} rec={rec} source={recs!.source} />)}
        </ul>
      )}

      {/* The data behind the set, folded away; it stays checkable without crowding the page */}
      {snapshot && (
        <details className="group border-t border-gray-100">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 select-none">
            <ChevronDown {...ICON} size={13} className="transition-transform group-open:rotate-180" />
            {tr("Farm data the agent used")}
          </summary>
          <div className="pb-3 space-y-2">
            {farm && <DataList title={tr("Post-Harvest Management")} rows={farmRows(farm)}
              caption={tr("Last {0} days, up to {1}. Weights in kg.", farm.period_days, farm.date)} />}
            {sulur && <DataList title={tr("Sulur Inventory")} rows={sulurRows(sulur)}
              caption={tr("Current stock, up to {0}. Quantities in {1}.", sulur.date, sulur.unit)} />}
          </div>
        </details>
      )}

      <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-500">
        {tr("Recommendations are suggestions. Nothing is changed until you act on them in the relevant module.")}
      </p>
    </section>
  )
}
