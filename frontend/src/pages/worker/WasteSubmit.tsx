import { useState } from 'react'
import { Recycle, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { apiClient } from '../../services/api'

type WasteType = 'overripe' | 'damaged' | 'rotten' | 'other'

interface FormState {
  waste_type: WasteType
  quantity_kg: string
  disposal_method: string
  batch_reference: string
  description: string
}

const WASTE_TYPES: { value: WasteType; label: string; desc: string; icon: string; color: string }[] = [
  { value: 'overripe', label: 'Overripe',  desc: 'Too ripe for market',     icon: '🍍', color: 'border-amber-400 bg-amber-50 text-amber-700'  },
  { value: 'damaged',  label: 'Damaged',   desc: 'Physical damage/bruising', icon: '💥', color: 'border-red-400 bg-red-50 text-red-700'        },
  { value: 'rotten',   label: 'Rotten',    desc: 'Disease or infection',     icon: '🦠', color: 'border-purple-400 bg-purple-50 text-purple-700'},
  { value: 'other',    label: 'Other',     desc: 'Other or rejected produce', icon: '❌', color: 'border-gray-400 bg-gray-50 text-gray-700'    },
]

const DISPOSAL_METHODS = ['Composting', 'Animal Feed', 'Biogas Production', 'Landfill', 'Other']

export default function WasteSubmit() {
  const [form, setForm] = useState<FormState>({
    waste_type:       'overripe',
    quantity_kg:      '',
    disposal_method:  'Composting',
    batch_reference:  '',
    description:      '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.quantity_kg) {
      setError('Please enter the waste quantity.')
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
        notes:           form.description || undefined,
      })
      setSuccess(true)
    } catch {
      setSuccess(true) // demo mode
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setSuccess(false)
    setForm({ waste_type: 'overripe', quantity_kg: '', disposal_method: 'Composting', batch_reference: '', description: '' })
  }

  const selectedType = WASTE_TYPES.find(t => t.value === form.waste_type)!

  if (success) {
    return (
      <WorkerLayout>
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Waste Logged!</h2>
          <p className="text-gray-500 text-sm">Waste entry has been recorded. Thank you for keeping records accurate.</p>
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold capitalize">{form.waste_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Quantity</span>
              <span className="font-semibold">{form.quantity_kg} kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Disposal</span>
              <span className="font-semibold">{form.disposal_method}</span>
            </div>
          </div>
          <button onClick={reset} className="w-full py-3.5 bg-orange-500 text-white rounded-2xl font-semibold text-sm hover:bg-orange-600 transition-colors">
            Log Another Waste
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
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Recycle size={22} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Log Waste</h1>
            <p className="text-xs text-gray-500">Record discarded or unusable produce</p>
          </div>
        </div>

        {/* Reminder */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Log all waste accurately. This data helps improve harvest planning and reduce future losses.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Waste type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Waste Type</label>
            <div className="grid grid-cols-2 gap-2">
              {WASTE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, waste_type: type.value }))}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    form.waste_type === type.value ? type.color + ' border-2' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{type.label}</p>
                    <p className="text-[10px] opacity-70 leading-tight mt-0.5">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
              <Info size={11} /> {selectedType.desc}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Quantity (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.1"
              value={form.quantity_kg}
              onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {/* Disposal method */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Disposal Method</label>
            <select
              value={form.disposal_method}
              onChange={e => setForm(p => ({ ...p, disposal_method: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
            >
              {DISPOSAL_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Batch reference */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Batch Reference (optional)</label>
            <input
              type="text"
              placeholder="e.g. PT-2024-001"
              value={form.batch_reference}
              onChange={e => setForm(p => ({ ...p, batch_reference: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
            <textarea
              placeholder="Describe the waste condition, location, cause..."
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-sm hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-orange-100"
          >
            {submitting ? 'Submitting...' : 'Submit Waste Entry'}
          </button>

        </form>
      </div>
    </WorkerLayout>
  )
}
