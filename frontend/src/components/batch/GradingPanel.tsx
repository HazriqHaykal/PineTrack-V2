import React, { useState } from 'react'
import { AlertTriangle, ClipboardCheck, Info, Pencil } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../../services/api'
import { BatchGrading } from '../../types'
import { GRADE_META } from './GradeBadge'
import GradingFields from './GradingFields'
import { EMPTY_GRADE_INPUTS, GradeInputs, fmtKg, gradeInputsFrom, gradesPayload, previewGrading } from './grading'

import { tr } from '../../i18n'
/** A label with its explanation on hover and for screen readers */
function Hint({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={text}>
      {children}
      <Info size={12} className="opacity-60 shrink-0 cursor-help" aria-hidden />
      <span className="sr-only">: {text}</span>
    </span>
  )
}

function GradeDistribution({ g }: { g: BatchGrading }) {
  const total = g.harvested_kg || 1
  const sortedOut = g.rejected_at_sorting_kg ?? 0
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 gap-px" role="img"
        aria-label={[...g.grades.map((r) => tr("Grade {0} {1}", r.grade, fmtKg(r.quantity_kg))), tr("Non-marketable {0}", fmtKg(sortedOut))].join(', ')}>
        {g.grades.filter((r) => r.quantity_kg > 0).map((r) => (
          <div key={r.grade} className={GRADE_META[r.grade].dot} style={{ width: `${(r.quantity_kg / total) * 100}%` }}
            title={tr("Grade {0}: {1}", r.grade, fmtKg(r.quantity_kg))} />
        ))}
        {sortedOut > 0 && (
          <div className="bg-gray-500" style={{ width: `${(sortedOut / total) * 100}%` }} title={tr("Non-marketable: {0}", fmtKg(sortedOut))} />
        )}
      </div>
      <table className="w-full mt-3 text-sm">
        <caption className="sr-only">{tr("Quantity by grade")}</caption>
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="text-left font-medium py-1">{tr("Grade")}</th>
            <th className="text-left font-medium py-1">{tr("Status")}</th>
            <th className="text-right font-medium py-1">{tr("Quantity")}</th>
            <th className="text-right font-medium py-1">{tr("Share")}</th>
          </tr>
        </thead>
        <tbody>
          {g.grades.map((r) => (
            <tr key={r.grade} className="border-t border-gray-100">
              <td className="py-2">
                <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                  <span className={`h-2.5 w-2.5 rounded-sm ${GRADE_META[r.grade].dot}`} aria-hidden />{tr("Grade")} {r.grade}
                </span>
              </td>
              <td className={`py-2 text-xs ${r.is_marketable ? 'text-gray-600' : 'text-red-700'}`}>
                {r.is_marketable ? tr("Marketable") : tr("Non-marketable")}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-gray-900">{fmtKg(r.quantity_kg)}</td>
              <td className="py-2 text-right tabular-nums text-gray-600">{r.percent}%</td>
            </tr>
          ))}
          {sortedOut > 0 && (
            <tr className="border-t border-gray-100">
              <td className="py-2">
                <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                  <span className="h-2.5 w-2.5 rounded-sm bg-gray-500" aria-hidden />{tr("Non-marketable")}
                </span>
              </td>
              <td className="py-2 text-xs text-gray-600">{tr("Sorted out, logged as waste")}</td>
              <td className="py-2 text-right tabular-nums font-medium text-gray-900">{fmtKg(sortedOut)}</td>
              <td className="py-2 text-right tabular-nums text-gray-600">{Math.round((sortedOut / total) * 10000) / 100}%</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function YieldFigures({ g }: { g: BatchGrading }) {
  const deducted = g.spoilage_kg > 0 || g.rejected_kg > 0
  const notMarketable = (g.non_marketable_kg ?? 0) + g.spoilage_kg + g.rejected_kg
  const cards = [
    {
      name: tr("Marketable quantity"), value: fmtKg(g.marketable_kg),
      hint: tr("Physical stock that can be sold: the marketable grades minus spoilage and rejection. Transport is allocated from this."),
      strong: true,
    },
    {
      name: tr("Non-marketable"), value: fmtKg(notMarketable),
      hint: tr("Fruit sorted out as non-marketable, spoiled or rejected later, plus any grade the farm policy excludes. Each kilogram is counted once."),
    },
    {
      name: tr("Marketable yield"), value: `${g.marketable_yield_percent}%`,
      hint: tr("Marketable quantity as a share of the harvested weight. A ratio, not a weight."),
    },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.name} className={`rounded-xl px-4 py-3 ${c.strong ? 'bg-green-800 text-white' : 'bg-white border border-gray-200'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${c.strong ? 'text-green-50' : 'text-gray-600'}`}>
              <Hint text={c.hint}>{c.name}</Hint>
            </p>
            <p className={`text-2xl font-bold mt-0.5 tabular-nums ${c.strong ? 'text-white' : 'text-gray-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>
      {(deducted || (g.non_marketable_kg ?? 0) > 0) && (
        <dl className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
          {([
            [tr("Harvested"), fmtKg(g.harvested_kg)],
            (g.rejected_at_sorting_kg ?? 0) > 0 ? [tr("Non-marketable at sorting"), `− ${fmtKg(g.rejected_at_sorting_kg ?? 0)}`] : null,
            (g.non_marketable_kg ?? 0) > 0 ? [tr("Excluded grades"), `− ${fmtKg(g.non_marketable_kg ?? 0)}`] : null,
            g.spoilage_kg > 0 ? [tr("Spoiled"), `− ${fmtKg(g.spoilage_kg)}`] : null,
            (g.rejected_after_grading_kg ?? 0) > 0 ? [tr("Rejected after grading"), `− ${fmtKg(g.rejected_after_grading_kg ?? 0)}`] : null,
          ].filter(Boolean) as string[][]).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-gray-700"><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>
          ))}
          <div className="flex justify-between py-1 border-t border-gray-200 font-semibold text-gray-900">
            <dt>{tr("Marketable quantity now")}</dt><dd className="tabular-nums">{fmtKg(g.marketable_kg)} ({g.marketable_yield_percent}%)</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function PolicyNote({ g }: { g: BatchGrading }) {
  const stale = g.policy_version != null && g.current_policy_version != null && g.policy_version !== g.current_policy_version
  return (
    <div className="flex gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-700">
      <Info size={14} className="shrink-0 mt-0.5 text-gray-500" />
      <div className="space-y-1">
        <p>
          <span className="font-medium text-gray-900">{tr("Marketability policy")}{g.policy_version ? ` v${g.policy_version}` : ''}: </span>
          {tr("Grades")} {(g.marketable_grades ?? []).join(', ') || 'none'} {tr("counted as marketable.")}
        </p>
        <p className="text-gray-600">{g.policy_explanation}</p>
        {stale && (
          <p className="text-amber-800">
            {tr("The farm policy is now v")}{g.current_policy_version}{tr(". This batch keeps v")}{g.policy_version} {tr("unless its grade quantities are saved again.")}
          </p>
        )}
      </div>
    </div>
  )
}

/** Grading & Yield tab of the batch details page */
export default function GradingPanel({ batchId, grading, onSaved }: {
  batchId: number; grading: BatchGrading; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<GradeInputs>({ ...EMPTY_GRADE_INPUTS })
  const [nonMarketable, setNonMarketable] = useState('')
  const [reason, setReason] = useState('damaged')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graded = grading.basis === 'grade_based'
  const total = String(grading.harvested_kg)

  const start = () => {
    setValues(graded ? gradeInputsFrom(Object.fromEntries(grading.grades.map((r) => [r.grade, r.quantity_kg]))) : { ...EMPTY_GRADE_INPUTS })
    setNonMarketable(graded && grading.rejected_at_sorting_kg ? String(grading.rejected_at_sorting_kg) : '')
    setReason('damaged')
    setError(null)
    setEditing(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const preview = previewGrading(total, values, [], nonMarketable)
    if (preview.empty || preview.error) {
      setError(preview.error ?? tr("Enter the quantity of at least one grade."))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiClient.updateHarvest(batchId, {
        grades: gradesPayload(values, nonMarketable) ?? {},
        non_marketable_kg: Number(nonMarketable) || 0,
        non_marketable_reason: reason,
      })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not save the grade quantities")))
    } finally {
      setSaving(false)
    }
  }

  const editor = editing && (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">{graded ? tr("Edit grade quantities") : tr("Record grade quantities")}</p>
      <p className="text-xs text-gray-600">{tr("The grades and non-marketable fruit must add up to the")} {fmtKg(grading.harvested_kg)} {tr("harvested.")}</p>
      <GradingFields total={total} values={values} onChange={setValues} idPrefix={`batch-${batchId}-grade`}
        nonMarketable={nonMarketable} onNonMarketableChange={setNonMarketable} reason={reason} onReasonChange={setReason} />
      {error && (
        <p className="flex gap-2 text-sm text-red-700"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setEditing(false)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">{tr("Cancel")}</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? tr("Saving…") : tr("Save grades")}
        </button>
      </div>
    </form>
  )

  if (!graded) {
    const legacy = grading.basis === 'legacy'
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-5">
          <ClipboardCheck size={24} className="text-gray-400" />
          <div>
            <p className="font-medium text-gray-900">
              {legacy ? tr("Legacy record: graded as a single Grade {0}", grading.legacy_grade) : tr("Not graded yet")}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {legacy
                ? tr("This batch was recorded before grade quantities were introduced, so no A–D breakdown exists. Its marketable quantity uses Harvested − Spoilage − Rejected and is not included in grade-based yield figures.")
                : tr("No grade quantities have been recorded. Missing grades are not counted as poor quality; the batch is left out of grade-based yield figures until it is graded.")}
            </p>
            <p className="text-sm text-gray-900 mt-2">
              {tr("Marketable quantity:")} <span className="font-semibold tabular-nums">{fmtKg(grading.marketable_kg)}</span>
              <span className="text-gray-600"> ({grading.marketable_yield_percent}%{legacy ? tr(", legacy calculation") : ', provisional'})</span>
            </p>
          </div>
          {!editing && (
            <button onClick={start}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium">
              <ClipboardCheck size={15} /> {tr("Record grade quantities")}
            </button>
          )}
        </div>
        {editor}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-gray-900">{tr("Grading distribution")}</p>
          {!editing && (
            <button onClick={start} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline">
              <Pencil size={12} /> {tr("Edit grade quantities")}
            </button>
          )}
        </div>
        <GradeDistribution g={grading} />
      </div>
      {editor}
      <YieldFigures g={grading} />
      <PolicyNote g={grading} />
    </div>
  )
}

