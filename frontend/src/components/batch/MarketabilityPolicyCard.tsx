import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, Scale } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../../services/api'
import { GradeLetter, MarketabilityPolicy } from '../../types'
import { GRADES, GRADE_META } from './GradeBadge'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

/** Settings card: which grades the farm counts as marketable, saved as versions */
export default function MarketabilityPolicyCard() {
  const [history, setHistory] = useState<MarketabilityPolicy[]>([])
  const [selected, setSelected] = useState<GradeLetter[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    apiClient.listMarketabilityPolicies()
      .then((items) => {
        setHistory(items)
        setSelected(items[0]?.marketable_grades ?? [])
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load the marketability policy.')))

  useEffect(() => { load() }, [])

  const current = history[0]
  const changed = !!current && [...selected].sort().join() !== [...current.marketable_grades].sort().join()

  const toggle = (g: GradeLetter) =>
    setSelected((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))

  const save = async () => {
    if (selected.length === 0) {
      setError('At least one grade must be marketable.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiClient.updateMarketabilityPolicy({ marketable_grades: selected, note: note || undefined })
      setNote('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save the policy.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Scale size={15} className="text-slate-600" />
        <h3 className="text-sm font-bold text-gray-900">Marketability Policy</h3>
        {current && <span className="ml-auto text-xs text-gray-500">Version {current.version}</span>}
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-gray-500 -mt-1">
          Choose the grades the farm sells. By default every grade is marketable, and unsellable fruit is
          recorded as spoilage or rejection. Untick a grade only if the farm never sells it.
        </p>

        <fieldset>
          <legend className="sr-only">Marketable grades</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GRADES.map((g) => {
              const on = selected.includes(g)
              return (
                <label key={g}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    on ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(g)} className="accent-green-700" />
                  <span className={`h-2.5 w-2.5 rounded-full ${GRADE_META[g].dot}`} aria-hidden />
                  <span className="font-medium text-gray-900">Grade {g}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Marketable: {selected.length ? [...selected].sort().join(', ') : 'none'} · Not marketable:{' '}
            {GRADES.filter((g) => !selected.includes(g)).join(', ') || 'none'}
          </p>
        </fieldset>

        {changed && (
          <div>
            <label htmlFor="policy-note" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Reason for change (optional)
            </label>
            <input id="policy-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              placeholder="e.g. Grade C now sold to the processing plant"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="mt-1.5 text-xs text-amber-800">
              Saving creates version {(current?.version ?? 0) + 1}. Batches already graded keep the policy they were graded under.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || !changed}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Policy'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>

        {history.length > 0 && (
          <details className="group rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-700">
            <summary className="flex items-center gap-2 cursor-pointer list-none font-medium">
              Policy history ({history.length})
              <ChevronRight size={14} className="ml-auto text-gray-500 transition-transform group-open:rotate-90" />
            </summary>
            <ol className="mt-2 space-y-2">
              {history.map((p) => (
                <li key={p.version} className="border-t border-gray-200 pt-2 first:border-0 first:pt-0">
                  <p className="text-gray-900">
                    <span className="font-semibold">v{p.version}</span> · Grades {p.marketable_grades.join(', ')} marketable
                    {p.is_current && <span className="ml-1 text-green-700">(current)</span>}
                  </p>
                  <p className="text-gray-500">{formatDate(p.created_at)} · {p.created_by ?? 'System default'}</p>
                  {p.note && <p className="text-gray-600 mt-0.5">{p.note}</p>}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  )
}
