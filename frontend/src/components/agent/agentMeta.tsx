import { CalendarDays, Recycle, Sprout, Truck } from 'lucide-react'

/** Display names for the prediction types stored in ai_logs; the raw values stay unchanged */
export const PREDICTION_LABEL: Record<string, string> = {
  recommendations:      'Farm Recommendations',
  harvest_timing:       'Harvest Timing',
  waste_classification: 'Waste Classification',
  waste_analysis:       'Waste Recommendation',
}
export const predictionLabel = (t: string) =>
  PREDICTION_LABEL[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

export type Source = 'gemini' | 'rules'
export const sourceOf = (modelVersion?: string | null): Source => ((modelVersion ?? '').startsWith('gemini') ? 'gemini' : 'rules')
export const modelName = (modelVersion?: string | null) =>
  !modelVersion ? '—' : modelVersion.startsWith('gemini:') ? modelVersion.slice(7) : modelVersion === 'rules-v1' ? 'Built-in rules v1' : modelVersion

export function SourceBadge({ source, model }: { source: Source; model?: string | null }) {
  const gemini = source === 'gemini'
  return (
    <span title={model ? modelName(model) : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        gemini ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-gray-100 text-gray-700 ring-gray-200'
      }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${gemini ? 'bg-green-600' : 'bg-gray-400'}`} aria-hidden />
      {gemini ? 'Gemini' : 'Built-in rules'}
    </span>
  )
}

/**
 * What a stored confidence number actually means. None of them are measured
 * accuracy: rules use a fixed value per rule (or a readiness score), and Gemini
 * reports its own estimate.
 */
export function confidenceMeaning(predictionType: string, source: Source): string {
  if (source === 'gemini') {
    return "Gemini's own estimate of how sure it is. It has not been checked against real outcomes, so treat it as a rough signal, not an accuracy rate."
  }
  if (predictionType === 'harvest_timing') {
    return 'The built-in readiness score (ripeness, days since last harvest and field condition) divided by 100. It measures readiness, not the chance of being right.'
  }
  return 'A fixed value set for the built-in rule that produced this. It is not a measured accuracy.'
}

/** Recommendation categories from the backend, with the module each one points to */
export const REC_CATEGORY: Record<string, { label: string; icon: React.ElementType; path: string; module: string }> = {
  harvest:   { label: 'Harvest',    icon: Sprout,       path: '/harvest',   module: 'Harvest' },
  waste:     { label: 'Waste',      icon: Recycle,      path: '/waste',     module: 'Waste Management' },
  transport: { label: 'Transport',  icon: Truck,        path: '/transport', module: 'Transport' },
  schedule:  { label: 'Scheduling', icon: CalendarDays, path: '/schedule',  module: 'Scheduling' },
}

export const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High priority',   cls: 'text-red-700 bg-red-50 ring-red-200' },
  medium: { label: 'Medium priority', cls: 'text-amber-800 bg-amber-50 ring-amber-200' },
  low:    { label: 'Low priority',    cls: 'text-gray-600 bg-white ring-gray-200' },
}

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
