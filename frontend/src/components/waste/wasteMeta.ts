import { RecoveryRate, RecoveryRoute } from '../../types'

import { tr, trEnum, locale } from '../../i18n'
/** Display labels for the backend's waste enums (the values themselves come from the API) */

export const WASTE_TYPES = ['rotten', 'damaged', 'overripe', 'unused_parts', 'other'] as const
export const CLASSIFICATIONS = ['compostable', 'recyclable', 'non-recyclable'] as const

const WASTE_TYPE_LABEL: Record<string, string> = {
  rotten: tr("Rotten"), damaged: tr("Damaged"), overripe: tr("Overripe"), unused_parts: tr("Unused Parts"), other: tr("Other"),
}
const CLASSIFICATION_LABEL: Record<string, string> = {
  compostable: tr("Compostable"), recyclable: tr("Recyclable"), 'non-recyclable': tr("Non-recyclable"),
}
export const typeLabel = (t: string) => WASTE_TYPE_LABEL[t] ?? trEnum(t)
export const classLabel = (c: string) => CLASSIFICATION_LABEL[c] ?? c

/** Route colour dot, kept restrained */
export const ROUTE_DOT: Record<RecoveryRoute, string> = {
  processing: 'bg-amber-500',
  low_grade:  'bg-orange-500',
  feed:       'bg-teal-500',
  compost:    'bg-green-600',
  dispose:    'bg-gray-500',
  review:     'bg-gray-300',
}

export const CURRENCY = 'RM'

const money = (n: number) =>
  n >= 100 ? Math.round(n).toLocaleString(locale) : n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low == null || high == null) return tr("Not estimated")
  if (high === 0) return `${CURRENCY} 0`
  return `${CURRENCY} ${money(low)}–${money(high)}`
}

export function formatRate(r: Pick<RecoveryRate, 'low' | 'high'>): string {
  if (r.low == null || r.high == null) return tr("Not estimated")
  if (r.high === 0) return tr("{0} 0 per kg", CURRENCY)
  return tr("{0} {1}–{2} per kg", CURRENCY, r.low.toFixed(2), r.high.toFixed(2))
}
