import { GradeLetter, GradeQuantities } from '../../types'
import { GRADES } from './GradeBadge'

import { tr } from '../../i18n'
/** The four grade inputs as typed, so a blank stays blank */
export type GradeInputs = Record<GradeLetter, string>

export const EMPTY_GRADE_INPUTS: GradeInputs = { A: '', B: '', C: '', D: '' }

/** Pre-fill the inputs from a saved breakdown */
export function gradeInputsFrom(q: Partial<Record<GradeLetter, number>> | null | undefined): GradeInputs {
  if (!q) return { ...EMPTY_GRADE_INPUTS }
  return Object.fromEntries(GRADES.map((g) => [g, q[g] ? String(q[g]) : ''])) as GradeInputs
}

// Weights are compared in hundredths of a kg, matching the backend's 0.01 kg
// precision, so 50.1 + 30.1 + 10.05 + 10.05 equals 100.3 exactly
const hundredths = (value: string | number) => Math.round(Number(value) * 100)
const fromHundredths = (n: number) => n / 100

export const fmtKg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`

export interface GradingPreview {
  /** No grade typed: the batch is saved as not graded yet */
  empty: boolean
  /** Problem to fix before saving, or null */
  error: string | null
  /** Graded total equals the harvested total */
  reconciled: boolean
  harvested: number
  graded: number
  remaining: number
  marketable: number
  /** Grades the marketability policy excludes */
  nonMarketable: number
  /** Non-marketable kg sorted out at harvest (not in any grade) */
  sortedOut: number
  yieldPercent: number | null
}

/**
 * Live preview only; the backend recalculates on save and its figures are the
 * ones shown afterwards.
 */
export function previewGrading(
  total: string, inputs: GradeInputs, marketableGrades: GradeLetter[], nonMarketable = '',
): GradingPreview {
  const harvested = total.trim() === '' ? NaN : hundredths(total)
  const typed = GRADES.filter((g) => inputs[g].trim() !== '')
  const values = Object.fromEntries(GRADES.map((g) => [g, typed.includes(g) ? hundredths(inputs[g]) : 0])) as Record<GradeLetter, number>
  const sortedOut = nonMarketable.trim() === '' ? 0 : hundredths(nonMarketable)
  const graded = GRADES.reduce((s, g) => s + values[g], 0)
  const accounted = graded + (Number.isFinite(sortedOut) ? sortedOut : 0)
  const marketable = marketableGrades.reduce((s, g) => s + values[g], 0)
  const base = {
    harvested: Number.isFinite(harvested) ? fromHundredths(harvested) : 0,
    graded: fromHundredths(graded),
    remaining: Number.isFinite(harvested) ? fromHundredths(harvested - accounted) : 0,
    marketable: fromHundredths(marketable),
    nonMarketable: fromHundredths(graded - marketable),
    sortedOut: Number.isFinite(sortedOut) ? fromHundredths(sortedOut) : 0,
  }

  let error: string | null = null
  if (typed.length === 0 && nonMarketable.trim() === '') {
    return { ...base, empty: true, error: null, reconciled: false, yieldPercent: null }
  }
  const bad = typed.find((g) => !Number.isFinite(values[g]))
  const negative = typed.find((g) => values[g] < 0)
  const parts = sortedOut ? tr("grades and non-marketable kg") : 'grades'
  if (bad) error = tr("Grade {0} must be a number.", bad)
  else if (negative) error = tr("Grade {0} cannot be negative.", negative)
  else if (!Number.isFinite(sortedOut)) error = tr("Non-marketable must be a number.")
  else if (sortedOut < 0) error = tr("Non-marketable cannot be negative.")
  else if (!Number.isFinite(harvested) || harvested <= 0) error = tr("Enter the total harvested quantity first.")
  else {
    const over = typed.find((g) => values[g] > harvested)
    if (over) error = tr("Grade {0} cannot be more than the {1} harvested.", over, fmtKg(base.harvested))
    else if (sortedOut > harvested) error = tr("Non-marketable cannot be more than the {0} harvested.", fmtKg(base.harvested))
    else if (accounted === 0) error = tr("Enter the quantity of at least one grade.")
    else if (accounted !== harvested) {
      error = accounted < harvested
        ? tr("{0} still to grade. The {1} must add up to {2}.", fmtKg(base.remaining), parts, fmtKg(base.harvested))
        : tr("The {0} total {1}, which is {2} more than harvested.", parts, fmtKg(fromHundredths(accounted)), fmtKg(-base.remaining))
    }
  }

  const reconciled = error === null
  return {
    ...base,
    empty: false,
    error,
    reconciled,
    yieldPercent: reconciled ? Math.round((marketable / harvested) * 10000) / 100 : null,
  }
}

/** Sum of the typed grades plus non-marketable kg, as a string for the total ('' when nothing is typed) */
export function sumGrades(inputs: GradeInputs, nonMarketable = ''): string {
  const parts = [...GRADES.map((g) => inputs[g]), nonMarketable].filter((v) => v.trim() !== '')
  if (parts.length === 0) return ''
  const total = parts.reduce((s, v) => s + (Number.isFinite(Number(v)) ? hundredths(v) : 0), 0)
  return String(fromHundredths(total))
}

/** Waste types a farmer can give for non-marketable fruit (backend SORTED_OUT_WASTE_TYPES) */
export const NON_MARKETABLE_REASONS = [
  { value: 'damaged', label: tr("Damaged") },
  { value: 'rotten', label: tr("Rotten") },
  { value: 'overripe', label: tr("Overripe") },
  { value: 'other', label: tr("Other") },
] as const

/** Request payload: blanks become 0 once any grade is entered; undefined when nothing was entered */
export function gradesPayload(inputs: GradeInputs, nonMarketable = ''): GradeQuantities | undefined {
  if (GRADES.every((g) => inputs[g].trim() === '') && nonMarketable.trim() === '') return undefined
  return Object.fromEntries(GRADES.map((g) => [g, inputs[g].trim() === '' ? 0 : Number(inputs[g])])) as GradeQuantities
}

export const sameGrades = (a: GradeInputs, b: GradeInputs) =>
  GRADES.every((g) => hundredths(a[g] || 0) === hundredths(b[g] || 0))
