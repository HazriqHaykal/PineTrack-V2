import { useState } from 'react'
import { Check, CheckCircle2, ClipboardList, Layers, Scale } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkerLayout from '../../components/layout/WorkerLayout'
import GradingFields from '../../components/batch/GradingFields'
import { GRADES, GRADE_META } from '../../components/batch/GradeBadge'
import { EMPTY_GRADE_INPUTS, GradeInputs, fmtKg, gradesPayload, previewGrading, sumGrades } from '../../components/batch/grading'
import {
  ErrorNote, ICON_STROKE, Section, WorkerPage, inputCls, labelCls, primaryBtn, secondaryBtn,
} from '../../components/worker/ui'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Harvest } from '../../types'

const today = () => new Date().toISOString().split('T')[0]

interface FormState {
  field_section: string
  harvest_date: string
  /** Typed by hand only for a batch not sorted yet; otherwise the sum of the grades */
  quantity_kg: string
  not_sorted: boolean
  ripeness_level: string
  grades: GradeInputs
  non_marketable: string
  non_marketable_reason: string
  notes: string
}

const emptyForm = (): FormState => ({
  field_section: '',
  harvest_date: today(),
  quantity_kg: '',
  not_sorted: false,
  ripeness_level: '',
  grades: { ...EMPTY_GRADE_INPUTS },
  non_marketable: '',
  non_marketable_reason: 'damaged',
  notes: '',
})

/** The two ways a batch can be recorded, shown as a clear choice */
const FLOWS = [
  { sorted: true,  icon: Layers,        title: 'Sorted and graded', body: 'Weigh each grade now. The total is added up for you.' },
  { sorted: false, icon: ClipboardList, title: 'Not sorted yet',    body: 'Record the total weight; add the grades later from the batch page.' },
]

export default function HarvestEntry() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState<Harvest | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Graded batches: the total is the grades plus non-marketable kg, so it always reconciles
  const total = form.not_sorted ? form.quantity_kg : sumGrades(form.grades, form.non_marketable)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = parseFloat(total)
    if (!form.field_section.trim()) {
      setError('Enter the field section.')
      return
    }
    if (!form.not_sorted) {
      const grading = previewGrading(total, form.grades, [], form.non_marketable)
      if (grading.empty) {
        setError('Enter the weight of at least one grade, or choose "Not sorted yet" to record the total only.')
        return
      }
      if (grading.error) {
        setError(`Grading breakdown: ${grading.error}`)
        return
      }
    }
    if (!(quantity > 0)) {
      setError('Total harvested quantity must be greater than 0 kg.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const created = await apiClient.createHarvest({
        field_name:     form.field_section.trim(),
        harvest_date:   form.harvest_date,
        quantity_kg:    quantity,
        grades:         form.not_sorted ? undefined : gradesPayload(form.grades, form.non_marketable),
        ...(!form.not_sorted && Number(form.non_marketable) > 0
          ? { non_marketable_kg: Number(form.non_marketable), non_marketable_reason: form.non_marketable_reason }
          : {}),
        ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
        notes:          form.notes || undefined,
      })
      setSaved(created)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the harvest. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSaved(null)
    setForm(emptyForm())
  }

  if (saved) {
    // Figures below come from the backend's calculation, not the preview
    const q = saved.grade_quantities
    const sortedOut = saved.rejected_at_sorting_kg ?? 0
    return (
      <WorkerLayout>
        <WorkerPage title="Harvest Logged" subtitle={`Batch ${saved.batch_number} has been recorded.`} narrow>
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
                <CheckCircle2 size={22} strokeWidth={ICON_STROKE} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{saved.batch_number}</p>
                <p className="text-xs text-gray-500 truncate">{saved.field_name} · {saved.harvest_date}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total harvested</dt>
                <dd className="font-semibold tabular-nums text-gray-900">{fmtKg(saved.quantity_kg)}</dd>
              </div>
              {q ? (
                <>
                  {GRADES.map((g) => (
                    <div key={g} className="flex justify-between">
                      <dt className="flex items-center gap-2 text-gray-600">
                        <span className={`h-2.5 w-2.5 rounded-full ${GRADE_META[g].dot}`} />Grade {g}
                      </dt>
                      <dd className="tabular-nums text-gray-900">{fmtKg(q[g])}</dd>
                    </div>
                  ))}
                  {sortedOut > 0 && (
                    <div className="flex justify-between">
                      <dt className="flex items-center gap-2 text-gray-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />Non-marketable
                      </dt>
                      <dd className="tabular-nums text-gray-900">{fmtKg(sortedOut)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <dt className="font-medium text-gray-700">Marketable</dt>
                    <dd className="font-semibold tabular-nums text-green-800">
                      {fmtKg(saved.marketable_yield_kg)} ({saved.marketable_yield_percent}%)
                    </dd>
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  Not graded yet. When sorting is done, open the batch and use Grading &amp; Yield to record the grades.
                </p>
              )}
            </dl>
            {sortedOut > 0 && (
              <p className="mt-3 text-xs text-gray-500">The non-marketable fruit was logged in Waste Management for this batch.</p>
            )}
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={resetForm} className={primaryBtn}>Log Another Harvest</button>
            <button onClick={() => navigate(`/harvest/${saved.id}?tab=grading`)} className={secondaryBtn}>View This Batch</button>
          </div>
        </WorkerPage>
      </WorkerLayout>
    )
  }

  return (
    <WorkerLayout>
      <WorkerPage title="New Harvest" subtitle="Record a batch and the weight of each grade" narrow
        actions={
          <button type="button" onClick={() => navigate('/my-records')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ClipboardList size={15} strokeWidth={ICON_STROKE} /> My Records
          </button>
        }>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          <Section title="Harvest Information" description="The batch number is assigned automatically when you submit.">
            <div>
              <label htmlFor="field_section" className={labelCls}>Field section <span className="text-red-600">*</span></label>
              <input id="field_section" type="text" placeholder="e.g. Block A-3, Row 12" value={form.field_section}
                onChange={e => setForm(p => ({ ...p, field_section: e.target.value }))} className={inputCls} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="harvest_date" className={labelCls}>Harvest date</label>
                <input id="harvest_date" type="date" max={today()} value={form.harvest_date}
                  onChange={e => setForm(p => ({ ...p, harvest_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="ripeness" className={labelCls}>Ripeness <span className="font-normal text-gray-500">(optional, 0–10)</span></label>
                  {form.ripeness_level && (
                    <button type="button" onClick={() => setForm(p => ({ ...p, ripeness_level: '' }))}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800">Clear</button>
                  )}
                </div>
                <div className="flex h-[42px] items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5">
                  <input id="ripeness" type="range" min="0" max="10" step="0.5"
                    value={form.ripeness_level || '5'}
                    onChange={e => setForm(p => ({ ...p, ripeness_level: e.target.value }))}
                    className="flex-1 accent-green-700" />
                  <span className={`w-14 shrink-0 whitespace-nowrap text-right text-sm tabular-nums ${form.ripeness_level ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                    {form.ripeness_level ? `${form.ripeness_level}/10` : 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Grading Breakdown">
            <div role="radiogroup" aria-label="Has the batch been sorted?" className="grid gap-2.5 sm:grid-cols-2">
              {FLOWS.map(({ sorted, icon: Icon, title, body }) => {
                const active = form.not_sorted !== sorted
                return (
                  <button key={title} type="button" role="radio" aria-checked={active}
                    onClick={() => setForm(p => ({ ...p, not_sorted: !sorted }))}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                      active ? 'border-green-700 bg-green-50 ring-1 ring-green-700' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-white text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      <Icon size={17} strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="min-w-0 pr-5">
                      <span className={`block text-sm font-semibold ${active ? 'text-green-900' : 'text-gray-900'}`}>{title}</span>
                      <span className="block text-xs leading-snug text-gray-600">{body}</span>
                    </span>
                    {active && <Check size={15} strokeWidth={2.5} className="absolute right-2.5 top-2.5 text-green-700" aria-hidden />}
                  </button>
                )
              })}
            </div>

            {form.not_sorted ? (
              <div>
                <label htmlFor="quantity_kg" className={labelCls}>Total harvested (kg) <span className="text-red-600">*</span></label>
                <input id="quantity_kg" type="number" inputMode="decimal" placeholder="0.00" min="0.01" step="0.01"
                  value={form.quantity_kg} onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))}
                  className={`${inputCls} tabular-nums`} />
                <p className="mt-1.5 text-xs text-gray-500">
                  The batch is saved as not graded. Missing grades are not counted as poor quality.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  Weigh each grade after sorting, plus any fruit that cannot be sold. Leave a field blank if there is none.
                </p>
                <GradingFields
                  touch
                  autoTotal
                  total={total}
                  values={form.grades}
                  onChange={grades => setForm(p => ({ ...p, grades }))}
                  nonMarketable={form.non_marketable}
                  onNonMarketableChange={v => setForm(p => ({ ...p, non_marketable: v }))}
                  reason={form.non_marketable_reason}
                  onReasonChange={v => setForm(p => ({ ...p, non_marketable_reason: v }))}
                  emptyHint="The total harvested weight is added up from the grades and non-marketable fruit."
                  idPrefix="entry-grade"
                />
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Scale size={16} strokeWidth={ICON_STROKE} className="text-gray-500" /> Total harvested
                  </span>
                  <span className="text-lg font-bold tabular-nums text-gray-900" aria-live="polite">
                    {total ? fmtKg(Number(total)) : '0 kg'}
                  </span>
                </div>
              </>
            )}
          </Section>

          <Section title="Additional Information">
            <div>
              <label htmlFor="notes" className={labelCls}>Notes <span className="font-normal text-gray-500">(optional)</span></label>
              <textarea id="notes" placeholder="Observations, issues or remarks" rows={3} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={`${inputCls} resize-none`} />
            </div>
          </Section>

          {error && <ErrorNote>{error}</ErrorNote>}

          <button type="submit" disabled={submitting} className={`${primaryBtn} w-full`}>
            {submitting ? 'Submitting…' : 'Submit Harvest Entry'}
          </button>
        </form>
      </WorkerPage>
    </WorkerLayout>
  )
}
