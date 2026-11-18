import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Bug, Check, CheckCircle2, Clock, Hammer } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import {
  ErrorNote, ICON_STROKE, Section, WorkerPage, inputCls, labelCls, primaryBtn, secondaryBtn,
} from '../../components/worker/ui'
import { typeLabel } from '../../components/waste/wasteMeta'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Harvest } from '../../types'
import AppSelect from '../../components/ui/AppSelect'
import SearchableSelect from '../../components/ui/SearchableSelect'

import { tr } from '../../i18n'
type WasteType = 'overripe' | 'damaged' | 'rotten' | 'other'

interface FormState {
  waste_type: WasteType
  quantity_kg: string
  disposal_method: string
  harvest_id: string
  description: string
}

const WASTE_TYPES: { value: WasteType; desc: string; icon: React.ElementType }[] = [
  { value: 'overripe', desc: tr("Too ripe for market"),       icon: Clock },
  { value: 'damaged',  desc: tr("Bruised or broken"),         icon: Hammer },
  { value: 'rotten',   desc: tr("Disease or infection"),      icon: Bug },
  { value: 'other',    desc: tr("Other or rejected produce"), icon: Ban },
]

const DISPOSAL_METHODS = ['Composting', 'Animal Feed', 'Biogas Production', 'Landfill', 'Other']

const EMPTY: FormState = { waste_type: 'overripe', quantity_kg: '', disposal_method: 'Composting', harvest_id: '', description: '' }

export default function WasteSubmit() {
  const [form, setForm] = useState<FormState>({ ...EMPTY })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState<Harvest[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const navigate = useNavigate()

  // A worker's own harvest batches, newest first
  useEffect(() => {
    apiClient.listHarvests(0, 100).then(d => setBatches(d.items)).catch(() => setBatches([]))
      .finally(() => setBatchesLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.quantity_kg || !(parseFloat(form.quantity_kg) > 0)) {
      setError(tr("Enter the waste quantity in kg."))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await apiClient.createWaste({
        waste_type:      form.waste_type,
        quantity_kg:     parseFloat(form.quantity_kg),
        classification:  'compostable',
        disposal_method: form.disposal_method,
        harvest_id:      form.harvest_id ? parseInt(form.harvest_id) : null,
        notes:           form.description || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not save the waste entry. Please try again.")))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setSuccess(false)
    setForm({ ...EMPTY })
  }

  if (success) {
    const batch = batches.find(b => String(b.id) === form.harvest_id)
    return (
      <WorkerLayout>
        <WorkerPage title={tr("Waste Logged")} narrow>
          <section className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700">
              <CheckCircle2 size={26} strokeWidth={ICON_STROKE} />
            </span>
            <p className="text-sm text-gray-600">{tr("The waste entry has been recorded.")}</p>
            <dl className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4 text-left text-sm">
              {[
                [tr("Type"), typeLabel(form.waste_type)],
                [tr("Quantity"), tr("{0} kg", form.quantity_kg)],
                [tr("Disposal"), form.disposal_method],
                [tr("Batch"), batch ? batch.batch_number : tr("Not linked")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-gray-500">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>
              ))}
            </dl>
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={reset} className={primaryBtn}>{tr("Log Another")}</button>
            <button onClick={() => navigate('/my-records')} className={secondaryBtn}>{tr("View My Records")}</button>
          </div>
        </WorkerPage>
      </WorkerLayout>
    )
  }

  return (
    <WorkerLayout>
      <WorkerPage title={tr("Log Waste")} subtitle={tr("Record produce that cannot be sold or used")} narrow>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          <Section title={tr("What was wasted?")}>
            <div role="radiogroup" aria-label={tr("Waste type")} className="grid grid-cols-2 gap-2.5">
              {WASTE_TYPES.map(({ value, desc, icon: Icon }) => {
                const active = form.waste_type === value
                return (
                  <button key={value} type="button" role="radio" aria-checked={active}
                    onClick={() => setForm(p => ({ ...p, waste_type: value }))}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                      active ? 'border-green-700 bg-green-50 ring-1 ring-green-700' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-white text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      <Icon size={17} strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${active ? 'text-green-900' : 'text-gray-900'}`}>{typeLabel(value)}</span>
                      <span className="block text-xs text-gray-500 leading-snug">{desc}</span>
                    </span>
                    {active && <Check size={15} strokeWidth={2.5} className="absolute right-2.5 top-2.5 text-green-700" aria-hidden />}
                  </button>
                )
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="waste_qty" className={labelCls}>{tr("Quantity (kg)")} <span className="text-red-600">*</span></label>
                <input id="waste_qty" type="number" inputMode="decimal" placeholder="0.00" min="0" step="0.01"
                  value={form.quantity_kg} onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))}
                  className={`${inputCls} tabular-nums`} />
              </div>
              <div>
                <label htmlFor="waste_disposal" className={labelCls}>{tr("Disposal method")}</label>
                <AppSelect id="waste_disposal" value={form.disposal_method}
                  onChange={v => setForm(p => ({ ...p, disposal_method: v }))}
                  options={DISPOSAL_METHODS.map(m => ({ value: m, label: tr(m) }))} />
              </div>
            </div>
          </Section>

          <Section title={tr("Details")} description={tr("Optional, but linking a batch keeps its records complete.")}>
            <div>
              <label htmlFor="waste_batch" className={labelCls}>{tr("Harvest batch")}</label>
              <SearchableSelect id="waste_batch" value={form.harvest_id}
                onChange={v => setForm(p => ({ ...p, harvest_id: v }))}
                emptyOptionLabel={tr("Not from a specific batch")} placeholder={tr("Not from a specific batch")}
                searchPlaceholder={tr("Search batch number or field")} loading={batchesLoading}
                noResultsText={tr("No batches match")}
                options={batches.map(h => ({
                  value: String(h.id), label: h.batch_number, keywords: h.field_name,
                  description: tr("{0} · {1} kg · {2}", h.field_name, h.quantity_kg.toLocaleString(), h.harvest_date),
                }))} />
            </div>
            <div>
              <label htmlFor="waste_notes" className={labelCls}>{tr("Notes")}</label>
              <textarea id="waste_notes" placeholder={tr("Condition, location or cause")} rows={3}
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
          </Section>

          {error && <ErrorNote>{error}</ErrorNote>}

          <button type="submit" disabled={submitting} className={`${primaryBtn} w-full`}>
            {submitting ? tr("Submitting…") : tr("Submit Waste Entry")}
          </button>
        </form>
      </WorkerPage>
    </WorkerLayout>
  )
}
