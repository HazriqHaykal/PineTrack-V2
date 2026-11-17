import { LifecycleStatus } from '../../types'

/**
 * The backend reports eight detailed lifecycle codes. For scanning, they are
 * grouped into six user-facing stages; the detailed meaning stays in the tooltip.
 */
export type LifecycleStage = 'recorded' | 'ready' | 'allocated' | 'in_transit' | 'delivered' | 'rejected'

export const STAGE_OF: Record<LifecycleStatus, LifecycleStage> = {
  awaiting_inspection: 'recorded',
  ready_for_dispatch:  'ready',
  partially_allocated: 'allocated',
  fully_allocated:     'allocated',
  in_transit:          'in_transit',
  partially_delivered: 'delivered',
  delivered:           'delivered',
  closed:              'rejected',
}

export const STAGES: { stage: LifecycleStage; label: string; badge: string; dot: string; meaning: string }[] = [
  { stage: 'recorded',   label: 'Recorded',   badge: 'bg-gray-100 text-gray-700 ring-gray-200',          dot: 'bg-gray-400',    meaning: 'Harvest logged, waiting for quality grading.' },
  { stage: 'ready',      label: 'Ready',      badge: 'bg-teal-50 text-teal-800 ring-teal-200',           dot: 'bg-teal-500',    meaning: 'Graded, with stock free to allocate.' },
  { stage: 'allocated',  label: 'Allocated',  badge: 'bg-amber-50 text-amber-800 ring-amber-200',        dot: 'bg-amber-500',   meaning: 'Stock reserved for a transport.' },
  { stage: 'in_transit', label: 'In Transit', badge: 'bg-blue-50 text-blue-800 ring-blue-200',           dot: 'bg-blue-500',    meaning: 'A linked transport is on the road.' },
  { stage: 'delivered',  label: 'Delivered',  badge: 'bg-green-50 text-green-800 ring-green-200',        dot: 'bg-green-600',   meaning: 'Stock has reached its destination.' },
  { stage: 'rejected',   label: 'Rejected',   badge: 'bg-red-50 text-red-800 ring-red-200',              dot: 'bg-red-500',     meaning: 'Rejected at grading, or nothing marketable left.' },
]

export const stageInfo = (code: LifecycleStatus) =>
  STAGES.find((s) => s.stage === STAGE_OF[code]) ?? STAGES[0]

/** Plain-language meaning of each detailed status, shown as a tooltip */
export const LIFECYCLE_DESCRIPTIONS: Record<LifecycleStatus, string> = {
  awaiting_inspection: 'Harvested but not yet graded.',
  ready_for_dispatch:  'Graded, with marketable stock free to allocate to a transport.',
  partially_allocated: 'Some marketable stock is reserved for transport; some is still free.',
  fully_allocated:     'All marketable stock is reserved for transport.',
  in_transit:          'At least one linked transport is on the road.',
  partially_delivered: 'Some stock has been delivered; the rest is reserved or still free.',
  delivered:           'All marketable stock has been delivered.',
  closed:              'Rejected at grading, or nothing marketable is left.',
}

/** One short, colour-coded stage badge. `label` is the backend's detailed label, used in the tooltip. */
export default function LifecycleBadge({ code, label, title }: {
  code: LifecycleStatus; label?: string; title?: string
}) {
  const s = stageInfo(code)
  const tip = title ?? `${label ? `${label}: ` : ''}${LIFECYCLE_DESCRIPTIONS[code] ?? ''}`
  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {code === 'partially_delivered' ? 'Part Delivered' : s.label}
    </span>
  )
}
