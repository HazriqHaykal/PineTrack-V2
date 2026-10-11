import { useState } from 'react'
import { CheckCircle2, Sprout, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { apiClient, apiErrorMessage } from '../../services/api'

type Grade = 'A' | 'B' | 'C' | 'D'

interface FormState {
  quantity_kg: string
  quality_grade: Grade
  ripeness_level: string
  field_section: string
  notes: string
}

const EMPTY_FORM: FormState = {
  quantity_kg: '',
  quality_grade: 'A',
  ripeness_level: '',
  field_section: '',
  notes: '',
}

const GRADE_INFO: Record<Grade, { label: string; color: string; desc: string }> = {
  A: { label: 'Grade A', color: 'bg-green-500 text-white border-green-500',   desc: 'Premium quality, no defects' },
  B: { label: 'Grade B', color: 'bg-blue-500 text-white border-blue-500',     desc: 'Good quality, minor blemishes' },
  C: { label: 'Grade C', color: 'bg-amber-500 text-white border-amber-500',   desc: 'Acceptable, visible defects' },
  D: { label: 'Grade D', color: 'bg-red-500 text-white border-red-500',       desc: 'Poor quality, major defects' },
}

export default function HarvestEntry() {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.quantity_kg || !form.field_section) {
      setError('Please fill in all required fields.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const created = await apiClient.createHarvest({
        field_name:     form.field_section,
        harvest_date:   new Date().toISOString().split('T')[0],
        quantity_kg:    parseFloat(form.quantity_kg),
        quality_grade:  form.quality_grade,
        ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
        notes:          form.notes || undefined,
      })
      setBatchNumber(created.batch_number)
      setSuccess(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the harvest. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSuccess(false)
    setBatchNumber('')
    setForm({ ...EMPTY_FORM })
  }

  if (success) {
    return (
      <WorkerLayout>
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Harvest Logged!</h2>
          <p className="text-gray-500 text-sm">
            Batch <span className="font-semibold text-gray-700">{batchNumber}</span> has been recorded successfully.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Quantity</span>
              <span className="font-semibold">{form.quantity_kg} kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Grade</span>
              <span className="font-semibold">{form.quality_grade}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Section</span>
              <span className="font-semibold">{form.field_section}</span>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="w-full py-3.5 bg-green-600 text-white rounded-2xl font-semibold text-sm hover:bg-green-700 transition-colors"
          >
            Log Another Harvest
          </button>
          <button onClick={() => navigate('/my-records')} className="w-full py-3 text-green-700 font-semibold text-sm">
            View my records
          </button>
        </div>
      </WorkerLayout>
    )
  }

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Sprout size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">New Harvest Entry</h1>
            <p className="text-xs text-gray-500">Record today's harvest batch</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Batch number (auto-generated) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Batch Number
            </label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-sm font-mono text-gray-400 flex-1">Assigned on submit</span>
              <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-full font-semibold">
                <Info size={10} /> Auto
              </div>
            </div>
          </div>

          {/* Field section */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Field Section <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Block A-3, Row 12"
              value={form.field_section}
              onChange={e => setForm(p => ({ ...p, field_section: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Total Weight (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.1"
              value={form.quantity_kg}
              onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
            />
          </div>

          {/* Quality grade */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Quality Grade
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['A', 'B', 'C', 'D'] as Grade[]).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, quality_grade: g }))}
                  className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    form.quality_grade === g
                      ? GRADE_INFO[g].color
                      : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
              <Info size={11} />
              {GRADE_INFO[form.quality_grade].desc}
            </p>
          </div>

          {/* Ripeness level */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Ripeness Level <span className="text-gray-400 normal-case font-normal">(optional, 0–10)</span>
            </label>
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <input
                type="range"
                min="0" max="10" step="0.5"
                value={form.ripeness_level || '5'}
                onChange={e => setForm(p => ({ ...p, ripeness_level: e.target.value }))}
                className="flex-1 accent-green-600"
              />
              <span className="w-10 text-right text-sm font-semibold text-gray-700">
                {form.ripeness_level || '—'}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Notes (optional)
            </label>
            <textarea
              placeholder="Any observations, issues, or remarks..."
              rows={3}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-green-200"
          >
            {submitting ? 'Submitting...' : 'Submit Harvest Entry'}
          </button>

        </form>
      </div>
    </WorkerLayout>
  )
}
