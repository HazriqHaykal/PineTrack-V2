import { AlertTriangle, RefreshCw } from 'lucide-react'
import RouteIllustration from './RouteIllustration'
import { formatRange, formatRate } from './wasteMeta'
import { RecoveryRate, WasteAnalysis } from '../../types'

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** One PineTrack Agent analysis: action, reasoning, alternatives, warning and the calculated value */
export default function RecommendationCard({ a, quantityKg, rate, onReanalyse, busy }: {
  a: WasteAnalysis
  quantityKg: number
  rate?: RecoveryRate
  onReanalyse?: () => void
  busy?: boolean
}) {
  const agent = a.source === 'gemini'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          agent ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-gray-100 text-gray-700 ring-gray-200'
        }`}>
          {agent ? `PineTrack Agent · ${Math.round(a.confidence * 100)}% confidence` : 'Built-in rules (agent unavailable)'}
        </span>
        <span className="text-[11px] text-gray-500">Analysed {stamp(a.analysed_at)}</span>
      </div>

      {a.stale && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span className="flex-1">This record was edited after the analysis. The advice below may no longer fit.</span>
        </div>
      )}

      <div className={`flex items-start gap-3 ${a.stale ? 'opacity-60' : ''}`}>
        <RouteIllustration route={a.route} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{a.route_label}</p>
          <p className="text-base font-semibold text-gray-900 leading-snug">{a.action}</p>
          <p className="mt-0.5 text-sm text-gray-700">{a.explanation}</p>
        </div>
      </div>

      {a.alternatives.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Alternative uses</p>
          <ul className="flex flex-wrap gap-1.5">
            {a.alternatives.map((alt) => (
              <li key={alt} className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700">{alt}</li>
            ))}
          </ul>
        </div>
      )}

      {(a.warning || !a.suitable_for_reuse) && (
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          {a.warning || 'Not suitable for reuse.'}
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-gray-600">Estimated recovery value</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{a.stale ? '—' : formatRange(a.value_low, a.value_high)}</p>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-gray-500">
          {a.value_low != null
            ? <>Calculated by PineTrack, not the AI: {quantityKg.toLocaleString()} kg × {formatRate({ low: a.rate_low, high: a.rate_high })} assumed for {a.route_label.toLowerCase()}. </>
            : null}
          {rate?.basis} Not actual income.
        </p>
      </div>

      {onReanalyse && (
        <button type="button" onClick={onReanalyse} disabled={busy}
          className={`inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-60 ${a.stale ? 'text-amber-900 hover:underline' : 'text-gray-600 hover:text-gray-900'}`}>
          <RefreshCw size={14} strokeWidth={1.75} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Analysing…' : a.stale ? 'Re-analyse now' : 'Re-analyse'}
        </button>
      )}
    </div>
  )
}
