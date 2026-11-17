import { tr } from '../../i18n'
export type Grade = 'A' | 'B' | 'C' | 'D'
export const GRADES: Grade[] = ['A', 'B', 'C', 'D']

/**
 * The single source of grade colours for admin and worker pages:
 * A green, B blue, C amber, D red. `accent` is a left border for grade inputs.
 */
export const GRADE_META: Record<Grade, { badge: string; dot: string; accent: string; meaning: string }> = {
  A: { badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600', accent: 'border-l-green-600', meaning: tr("Premium quality") },
  B: { badge: 'bg-blue-50 text-blue-800 ring-blue-200',    dot: 'bg-blue-500',  accent: 'border-l-blue-500',  meaning: tr("Good, minor flaws") },
  C: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', accent: 'border-l-amber-500', meaning: tr("Fair, processing grade") },
  D: { badge: 'bg-red-50 text-red-800 ring-red-200',       dot: 'bg-red-500',   accent: 'border-l-red-500',   meaning: tr("Poor quality") },
}

/** Same colours as the badge dots, for charts (Tailwind green-600, blue-500, amber-500, red-500, gray-400) */
export const GRADE_HEX: Record<Grade | 'ungraded', string> = {
  A: '#16a34a', B: '#3b82f6', C: '#f59e0b', D: '#ef4444', ungraded: '#9ca3af',
}

/**
 * The backend stores the grade as free text and defaults to "ungraded", so
 * values like "a", " A ", or "Grade A" can appear. Reduce any of them to the
 * raw grade letter, or null when the batch is ungraded or the value is unknown.
 */
export function normalizeGrade(value?: string | null): Grade | null {
  const v = (value ?? '').trim().toUpperCase().replace(/^GRADE\s*/, '')
  return (GRADES as string[]).includes(v) ? (v as Grade) : null
}

/** Overall label of a batch whose grading breakdown holds more than one grade */
export const MIXED_META = { badge: 'bg-slate-50 text-slate-800 ring-slate-300', dot: 'bg-slate-500', meaning: tr("Several grades; see the grading breakdown") }

export const isMixed = (value?: string | null) => (value ?? '').trim().toLowerCase() === 'mixed'

export default function GradeBadge({ grade }: { grade?: string | null }) {
  const g = normalizeGrade(grade)
  const mixed = !g && isMixed(grade)
  const cls = g ? GRADE_META[g].badge : mixed ? MIXED_META.badge : 'bg-gray-50 text-gray-600 ring-gray-200'
  return (
    <span
      title={g ? GRADE_META[g].meaning : mixed ? MIXED_META.meaning : tr("Not graded yet")}
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {g ? tr("Grade {0}", g) : mixed ? tr("Mixed Grades") : tr("Ungraded")}
    </span>
  )
}
