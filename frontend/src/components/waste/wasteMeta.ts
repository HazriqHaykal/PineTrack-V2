import { RecoveryRate, RecoveryRoute } from '../../types'

/** Display labels for the backend's waste enums (the values themselves come from the API) */

export const WASTE_TYPES = ['rotten', 'damaged', 'overripe', 'unused_parts', 'other'] as const
export const CLASSIFICATIONS = ['compostable', 'recyclable', 'non-recyclable'] as const

const WASTE_TYPE_LABEL: Record<string, string> = {
  rotten: 'Rotten', damaged: 'Damaged', overripe: 'Overripe', unused_parts: 'Unused Parts', other: 'Other',
}
const CLASSIFICATION_LABEL: Record<string, string> = {
  compostable: 'Compostable', recyclable: 'Recyclable', 'non-recyclable': 'Non-recyclable',
}
export const typeLabel = (t: string) => WASTE_TYPE_LABEL[t] ?? t.replace(/_/g, ' ')
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
  n >= 100 ? Math.round(n).toLocaleString('en-MY') : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low == null || high == null) return 'Not estimated'
  if (high === 0) return `${CURRENCY} 0`
  return `${CURRENCY} ${money(low)}–${money(high)}`
}

export function formatRate(r: Pick<RecoveryRate, 'low' | 'high'>): string {
  if (r.low == null || r.high == null) return 'Not estimated'
  if (r.high === 0) return `${CURRENCY} 0 per kg`
  return `${CURRENCY} ${r.low.toFixed(2)}–${r.high.toFixed(2)} per kg`
}
