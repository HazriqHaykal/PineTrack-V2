import { AlertCircle, CheckCircle2, Info, Recycle } from 'lucide-react'
import { GradeLetter } from '../../types'
import { GRADES, GRADE_META } from './GradeBadge'
import { GradeInputs, NON_MARKETABLE_REASONS, fmtKg, previewGrading } from './grading'
import { useMarketabilityPolicy } from '../../hooks/useMarketabilityPolicy'
import AppSelect from '../../components/ui/AppSelect'

import { tr } from '../../i18n'
interface Props {
  /** Total harvested quantity as typed */
  total: string
  values: GradeInputs
  onChange: (values: GradeInputs) => void
  /** Non-marketable kg sorted out at harvest; the field is shown when a handler is given */
  nonMarketable?: string
  onNonMarketableChange?: (value: string) => void
  reason?: string
  onReasonChange?: (value: string) => void
  /** Larger touch targets for the worker's phone form */
  touch?: boolean
  /** Shown when the inputs are blank, e.g. that the batch stays ungraded */
  emptyHint?: string
  idPrefix?: string
  /** The total is the sum of the inputs (farmer form), so there is nothing to reconcile */
  autoTotal?: boolean
}

/**
 * Grading Breakdown (FR08) with the live Marketable Yield Preview (FR09).
 * The farmer weighs each grade, and any non-marketable fruit, by hand. The
 * preview mirrors the backend calculation, which is authoritative once saved.
 */
export default function GradingFields({
  total, values, onChange, nonMarketable = '', onNonMarketableChange, reason = 'damaged', onReasonChange,
  touch, emptyHint, idPrefix = 'grade', autoTotal,
}: Props) {
  const { policy, failed } = useMarketabilityPolicy()
  const marketable: GradeLetter[] = policy?.marketable_grades ?? []
  const p = previewGrading(total, values, marketable, nonMarketable)
  const inputCls = touch
    ? 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white'
    : 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500 bg-white'
  const withSorting = !!onNonMarketableChange
  const barTotal = Math.max(p.harvested, p.graded + p.sortedOut) || 1

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{tr("Grading breakdown")}</legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GRADES.map((g) => {
          const id = `${idPrefix}-${g}`
          const isMarketable = marketable.includes(g)
          return (
            <div key={g} className={`rounded-lg border border-gray-200 border-l-4 ${GRADE_META[g].accent} bg-white p-2.5`}>
              <label htmlFor={id} className="block mb-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  {tr("Grade")} {g} <span className="text-xs font-normal text-gray-500">{tr("(kg)")}</span>
                </span>
                <span className="block text-[11px] leading-tight text-gray-500">{GRADE_META[g].meaning}</span>
              </label>
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                value={values[g]}
                onChange={(e) => onChange({ ...values, [g]: e.target.value })}
                aria-describedby={`${idPrefix}-status`}
                className={inputCls}
              />
              {policy && !isMarketable && <p className="mt-1 text-[11px] text-red-700">{tr("Excluded by farm policy")}</p>}
            </div>
          )
        })}
      </div>

      {withSorting && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${idPrefix}-nm`} className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-500" aria-hidden />
                {tr("Non-marketable")} <span className="text-xs font-normal text-gray-500">{tr("(kg)")}</span>
              </label>
              <input
                id={`${idPrefix}-nm`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                value={nonMarketable}
                onChange={(e) => onNonMarketableChange!(e.target.value)}
                aria-describedby={`${idPrefix}-nm-hint`}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-nm-reason`} className="block text-sm font-semibold text-gray-900 mb-1.5">{tr("Reason")}</label>
              <AppSelect
                id={`${idPrefix}-nm-reason`}
                value={reason}
                onChange={(v) => onReasonChange?.(v)}
                disabled={!(Number(nonMarketable) > 0)}
                options={NON_MARKETABLE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
              />
            </div>
          </div>
          <p id={`${idPrefix}-nm-hint`} className="mt-1.5 flex items-start gap-1.5 text-[11px] text-gray-600">
            <Recycle size={12} className="shrink-0 mt-px" />
            {tr("Fruit that cannot be sold. It counts in the total harvested and is logged in Waste Management for this batch.")}
          </p>
        </div>
      )}

      {/* Reconciliation: grades (+ non-marketable) against the harvested total */}
      <div id={`${idPrefix}-status`} aria-live="polite">
        {p.empty ? (
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <Info size={13} className="shrink-0 mt-px" />
            {emptyHint ?? tr("Enter the weight of each grade. The grades must add up to the total harvested.")}
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 gap-px" aria-hidden>
              {GRADES.map((g) => {
                const v = Number(values[g]) || 0
                return v > 0 ? <div key={g} className={GRADE_META[g].dot} style={{ width: `${Math.min(v / barTotal, 1) * 100}%` }} /> : null
              })}
              {p.sortedOut > 0 && <div className="bg-gray-500" style={{ width: `${Math.min(p.sortedOut / barTotal, 1) * 100}%` }} />}
            </div>
            {p.reconciled ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-green-800">
                <CheckCircle2 size={14} className="shrink-0" />
                {autoTotal
                  ? tr("Total harvested: {0}, the sum of the {1}", fmtKg(p.harvested), p.sortedOut > 0 ? 'grades and non-marketable' : 'grades')
                  : tr("{0} the harvested total of {1}", p.sortedOut > 0 ? 'Grades and non-marketable match' : 'Grades match', fmtKg(p.harvested))}
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-800">
                <AlertCircle size={14} className="shrink-0 mt-px" />
                {p.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Marketable Yield Preview */}
      {!p.empty && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">{tr("Marketable Yield Preview")}</p>
          {failed ? (
            <p className="text-xs text-gray-600">
              {tr("The marketability policy could not be loaded. The yield will be calculated when you save.")}
            </p>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              {[
                [tr("Total graded"), fmtKg(p.graded)],
                [tr("Marketable"), policy ? fmtKg(p.marketable) : '…'],
                ['Non-marketable', policy ? fmtKg(p.sortedOut + p.nonMarketable) : '…'],
                [tr("Marketable yield"), p.yieldPercent != null && policy ? `${p.yieldPercent}%` : '—'],
              ].map(([name, value]) => (
                <div key={name}>
                  <dt className="text-[11px] text-gray-500">{name}</dt>
                  <dd className="text-sm font-semibold text-gray-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {policy && (
            <p className="mt-2 text-[11px] text-gray-500">
              {tr("Grades")} {policy.marketable_grades.join(', ')} {tr("count as marketable (farm policy v")}{policy.version}{tr("). Spoilage or rejection recorded later is deducted from this. The final figures are calculated when you save.")}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}
