import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AIHarvestPrediction, AIWastePrediction, Harvest } from '../../types'
import { SourceBadge, confidenceMeaning } from './agentMeta'
import SearchableSelect from '../../components/ui/SearchableSelect'

type Tool = 'harvest' | 'waste'
const ICON = { size: 16, strokeWidth: 1.75 } as const

const WASTE_LABEL: Record<string, string> = {
  rotten: 'Rotten', damaged: 'Damaged', overripe: 'Overripe', unused_parts: 'Unused parts', other: 'Other',
}

function Slider({ id, label, value, min, max, step, low, high, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number; low: string; high: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-gray-800 mb-1">
        {label}<span className="text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-green-700" />
      <div className="flex justify-between text-[11px] text-gray-500"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}

function Confidence({ value, type, source }: { value: number; type: string; source: 'gemini' | 'rules' }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer list-none text-gray-500 hover:text-gray-800 select-none">About the confidence ({Math.round(value * 100)}%)</summary>
      <p className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">{confidenceMeaning(type, source)}</p>
    </details>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 text-center">
      <Lightbulb {...ICON} size={22} className="text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}

export default function AskAgent() {
  const [tool, setTool] = useState<Tool>('harvest')
  const [harvests, setHarvests] = useState<Harvest[]>([])

  const [hForm, setHForm] = useState({ harvest_id: '', ripeness_level: 6, days_since_last_harvest: 14, field_condition_score: 7 })
  const [hResult, setHResult] = useState<AIHarvestPrediction | null>(null)
  const [hBatch, setHBatch] = useState<Harvest | null>(null)
  const [hLoading, setHLoading] = useState(false)
  const [hError, setHError] = useState('')

  const [wForm, setWForm] = useState({ quality_grade: 'B', damage_level: 4, age_days: 5 })
  const [wResult, setWResult] = useState<AIWastePrediction | null>(null)
  const [wLoading, setWLoading] = useState(false)
  const [wError, setWError] = useState('')

  useEffect(() => {
    apiClient.listHarvests(0, 500).then((d) => setHarvests(d.items)).catch(() => setHarvests([]))
  }, [])

  const askHarvest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hForm.harvest_id) { setHError('Choose the batch to ask about.'); return }
    setHLoading(true); setHError(''); setHResult(null)
    try {
      setHResult(await apiClient.predictHarvestTiming({ ...hForm, harvest_id: Number(hForm.harvest_id) }))
      setHBatch(harvests.find((h) => String(h.id) === hForm.harvest_id) ?? null)
    } catch (err) {
      setHError(apiErrorMessage(err, 'PineTrack Agent could not respond. Please try again.'))
    } finally {
      setHLoading(false)
    }
  }

  const askWaste = async (e: React.FormEvent) => {
    e.preventDefault()
    setWLoading(true); setWError(''); setWResult(null)
    try {
      setWResult(await apiClient.predictWasteClassification(wForm))
    } catch (err) {
      setWError(apiErrorMessage(err, 'PineTrack Agent could not respond. Please try again.'))
    } finally {
      setWLoading(false)
    }
  }

  const card = 'bg-white rounded-xl border border-gray-100 shadow-sm p-5'
  const submit = 'w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-medium disabled:opacity-60'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div role="tablist" aria-label="Agent tool" className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
          {([['harvest', 'Harvest Timing'], ['waste', 'Waste Classification']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tool === k} onClick={() => setTool(k)}
              className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${tool === k ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 sm:text-right">
          The agent answers these two questions. Free-text chat is not available.
        </p>
      </div>

      {tool === 'harvest' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <form onSubmit={askHarvest} className={`${card} space-y-4`} noValidate>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">When should this block be harvested?</h2>
              <p className="text-xs text-gray-500 mt-0.5">Describe the field now; the agent recommends a harvest window.</p>
            </div>
            {hError && <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle {...ICON} className="shrink-0 mt-0.5" />{hError}</p>}
            <div>
              <label htmlFor="ask-batch" className="block text-sm font-medium text-gray-800 mb-1">Batch<span className="text-red-600 ml-0.5" aria-hidden>*</span></label>
              <SearchableSelect id="ask-batch" value={hForm.harvest_id} onChange={(v) => setHForm({ ...hForm, harvest_id: v })}
                placeholder="Select a batch…" searchPlaceholder="Search batch number or field" noResultsText="No batches match"
                options={harvests.map((h) => ({
                  value: String(h.id), label: h.batch_number, keywords: h.field_name,
                  description: `${h.field_name} · ${h.harvest_date}`,
                }))} />
              <p className="mt-1 text-xs text-gray-500">Gives the agent the field and the batch's recorded grade.</p>
            </div>
            <Slider id="ask-ripe" label="Ripeness level (0–10)" value={hForm.ripeness_level} min={0} max={10} step={0.5} low="Unripe" high="Fully ripe"
              onChange={(v) => setHForm({ ...hForm, ripeness_level: v })} />
            <Slider id="ask-days" label="Days since last harvest of this block" value={hForm.days_since_last_harvest} min={0} max={90} step={1} low="0" high="90"
              onChange={(v) => setHForm({ ...hForm, days_since_last_harvest: v })} />
            <Slider id="ask-field" label="Field condition (0–10)" value={hForm.field_condition_score} min={0} max={10} step={0.5} low="Poor" high="Excellent"
              onChange={(v) => setHForm({ ...hForm, field_condition_score: v })} />
            <button type="submit" disabled={hLoading} className={submit}>
              <Lightbulb {...ICON} /> {hLoading ? 'Asking the agent…' : 'Ask the agent'}
            </button>
          </form>

          {hResult ? (
            <div className={`${card} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-500">Recommendation{hBatch ? ` for ${hBatch.batch_number}` : ''}</p>
                <SourceBadge source={hResult.source ?? 'rules'} model={hResult.model_version} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">{hResult.recommendation}</p>
                {hResult.explanation && <p className="mt-1 text-sm text-gray-700 leading-relaxed">{hResult.explanation}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <dt className="text-xs text-gray-500">Expected quality</dt>
                  <dd className="text-sm font-semibold text-gray-900">{hResult.quality_prediction}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <dt className="text-xs text-gray-500">Transport urgency</dt>
                  <dd className="text-sm font-semibold text-gray-900">{hResult.transport_priority}</dd>
                </div>
              </dl>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-700">
                <p>Inputs: ripeness {hResult.reasoning.ripeness_level}/10 · {hResult.reasoning.days_since_harvest} days since last harvest · field condition {hResult.reasoning.field_condition}/10</p>
                <p className="mt-1">Built-in readiness score for these inputs: <span className="font-semibold">{hResult.reasoning.total_score}/100</span>
                  {hResult.source === 'gemini' ? ' (shown for comparison; Gemini made the recommendation)' : ''}</p>
              </div>
              <Confidence value={hResult.confidence_score} type="harvest_timing" source={hResult.source ?? 'rules'} />
              {hBatch && <Link to={`/harvest/${hBatch.id}`} className="inline-block text-sm font-medium text-green-800 hover:underline">Open {hBatch.batch_number}</Link>}
            </div>
          ) : <Placeholder text="Choose a batch, describe the field and ask the agent." />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <form onSubmit={askWaste} className={`${card} space-y-4`}>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">What kind of waste is this, and how should it be handled?</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                For waste already logged, use the per-record recommendations on <Link to="/waste" className="text-green-800 hover:underline">Waste Management</Link>.
              </p>
            </div>
            {wError && <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle {...ICON} className="shrink-0 mt-0.5" />{wError}</p>}
            <div>
              <p className="text-sm font-medium text-gray-800 mb-1">Quality grade (recorded at inspection)</p>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Quality grade">
                {['A', 'B', 'C', 'D'].map((g) => (
                  <button key={g} type="button" role="radio" aria-checked={wForm.quality_grade === g}
                    onClick={() => setWForm({ ...wForm, quality_grade: g })}
                    className={`h-9 rounded-lg text-sm font-semibold border transition-colors ${
                      wForm.quality_grade === g ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <Slider id="ask-damage" label="Damage level (0–10)" value={wForm.damage_level} min={0} max={10} step={0.5} low="None" high="Severe"
              onChange={(v) => setWForm({ ...wForm, damage_level: v })} />
            <Slider id="ask-age" label="Days since harvest" value={wForm.age_days} min={0} max={30} step={1} low="Fresh" high="30 days"
              onChange={(v) => setWForm({ ...wForm, age_days: v })} />
            <button type="submit" disabled={wLoading} className={submit}>
              <Lightbulb {...ICON} /> {wLoading ? 'Asking the agent…' : 'Ask the agent'}
            </button>
          </form>

          {wResult ? (
            <div className={`${card} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-500">Classification</p>
                <SourceBadge source={wResult.source ?? 'rules'} model={wResult.model_version} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">{WASTE_LABEL[wResult.waste_type] ?? wResult.waste_type}</p>
                {wResult.explanation && <p className="mt-1 text-sm text-gray-700 leading-relaxed">{wResult.explanation}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <dt className="text-xs text-gray-500">Suggested handling</dt>
                  <dd className="text-sm font-semibold text-gray-900 capitalize">{wResult.disposal_method}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <dt className="text-xs text-gray-500">Inputs</dt>
                  <dd className="text-sm text-gray-900">Grade {wResult.quality_grade} · damage {wResult.damage_level}/10 · {wResult.age_days} days</dd>
                </div>
              </dl>
              <Confidence value={wResult.confidence_score} type="waste_classification" source={wResult.source ?? 'rules'} />
            </div>
          ) : <Placeholder text="Set the grade, damage and age, then ask the agent." />}
        </div>
      )}
    </div>
  )
}
