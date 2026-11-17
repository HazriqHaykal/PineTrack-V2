import { CalendarDays, Layers, Recycle, Sprout, Truck } from 'lucide-react'

import { tr, trEnum, locale } from '../../i18n'
/** Display names for the prediction types stored in ai_logs; the raw values stay unchanged */
export const PREDICTION_LABEL: Record<string, string> = {
  recommendations:       tr("Post-Harvest Recommendations"),
  recommendations_sulur: tr("Sulur Recommendations"),
  recommendations_all:   tr("All-Module Recommendations"),
  harvest_timing:       tr("Harvest Timing"),
  waste_classification: tr("Waste Classification"),
  waste_analysis:       tr("Waste Recommendation"),
}
export const predictionLabel = (t: string) =>
  PREDICTION_LABEL[t] ?? trEnum(t).replace(/\b\w/g, (m) => m.toUpperCase())

export type Source = 'gemini' | 'rules'
export const sourceOf = (modelVersion?: string | null): Source => ((modelVersion ?? '').startsWith('gemini') ? 'gemini' : 'rules')
export const modelName = (modelVersion?: string | null) =>
  !modelVersion ? '—' : modelVersion.startsWith('gemini:') ? modelVersion.slice(7) : modelVersion === 'rules-v1' ? tr("Built-in rules v1") : modelVersion

export function SourceBadge({ source, model }: { source: Source; model?: string | null }) {
  const gemini = source === 'gemini'
  return (
    <span title={model ? modelName(model) : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        gemini ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-gray-100 text-gray-700 ring-gray-200'
      }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${gemini ? 'bg-green-600' : 'bg-gray-400'}`} aria-hidden />
      {gemini ? tr("Gemini") : tr("Built-in rules")}
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
    return tr("Gemini's own estimate of how sure it is. It has not been checked against real outcomes, so treat it as a rough signal, not an accuracy rate.")
  }
  if (predictionType === 'harvest_timing') {
    return tr("The built-in readiness score (ripeness, days since last harvest and field condition) divided by 100. It measures readiness, not the chance of being right.")
  }
  return tr("A fixed value set for the built-in rule that produced this. It is not a measured accuracy.")
}

/** Recommendation categories from the backend, with the module each one points to */
export const REC_CATEGORY: Record<string, { label: string; icon: React.ElementType; path: string; module: string }> = {
  harvest:   { label: tr("Harvest"),    icon: Sprout,       path: '/harvest',   module: tr("Harvest") },
  waste:     { label: tr("Waste"),      icon: Recycle,      path: '/waste',     module: tr("Waste Management") },
  transport: { label: tr("Transport"),  icon: Truck,        path: '/transport', module: tr("Transport") },
  schedule:  { label: tr("Scheduling"), icon: CalendarDays, path: '/schedule',  module: tr("Scheduling") },
  sulur:     { label: tr("Sulur Inventory"), icon: Layers, path: '/admin/sulur/stock', module: tr("Sulur Stock & Batches") },
}

export const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  high:   { label: tr("High priority"),   cls: 'text-red-700 bg-red-50 ring-red-200' },
  medium: { label: tr("Medium priority"), cls: 'text-amber-800 bg-amber-50 ring-amber-200' },
  low:    { label: tr("Low priority"),    cls: 'text-gray-600 bg-white ring-gray-200' },
}

/** Farm recommendation sets, one prediction type per analysis scope */
export const isRecommendationSet = (t: string) => t === 'recommendations' || t.startsWith('recommendations_')

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
