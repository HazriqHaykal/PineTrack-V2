import { useState } from 'react'
import { GradeLetter, Harvest } from '../../types'
import GradeBadge, { GRADES, GRADE_META, MIXED_META } from './GradeBadge'
import { fmtKg } from './grading'

type GradedFields = Pick<Harvest, 'quality_grade' | 'grading_basis' | 'grade_quantities' | 'marketable_grades'>

/**
 * Grade column of the harvest table. A batch with several grades shows
 * "Mixed Grades" with its A-D quantities on hover or focus; single-grade,
 * legacy and ungraded batches keep their usual badge.
 */
export default function GradeSummary({ harvest }: { harvest: GradedFields }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const q = harvest.grade_quantities
  const present = q ? GRADES.filter((g) => q[g] > 0) : []

  if (harvest.grading_basis !== 'grade_based' || !q || present.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <GradeBadge grade={harvest.quality_grade} />
        {harvest.grading_basis === 'legacy' && (
          <span className="text-[11px] text-gray-500" title="Recorded with one overall grade, before grading breakdowns">Legacy</span>
        )}
      </span>
    )
  }

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    // Fixed position, so the table's scroll container cannot clip it
    setPos({ x: Math.min(r.left, window.innerWidth - 248), y: r.bottom + 6 })
  }
  const total = present.reduce((s, g) => s + q[g], 0)
  const label = GRADES.map((g) => `Grade ${g} ${fmtKg(q[g])}`).join(', ')

  return (
    <span
      tabIndex={0}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
      aria-label={`Mixed grades: ${label}`}
      className="inline-flex flex-col gap-1 rounded-md cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
    >
      <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${MIXED_META.badge}`}>
        Mixed Grades
      </span>
      <span className="flex h-1 w-full min-w-[72px] overflow-hidden rounded-full bg-gray-100" aria-hidden>
        {present.map((g) => (
          <span key={g} className={GRADE_META[g].dot} style={{ width: `${(q[g] / total) * 100}%` }} />
        ))}
      </span>
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
          className="fixed z-50 w-60 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
        >
          {GRADES.map((g: GradeLetter) => (
            <span key={g} className="flex items-center gap-2 py-0.5">
              <span className={`h-2 w-2 rounded-full ${GRADE_META[g].dot}`} />
              <span className="text-gray-700">Grade {g}</span>
              {harvest.marketable_grades && !harvest.marketable_grades.includes(g) && (
                <span className="text-[11px] text-red-700">non-marketable</span>
              )}
              <span className="ml-auto font-semibold text-gray-900 tabular-nums">{fmtKg(q[g])}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
