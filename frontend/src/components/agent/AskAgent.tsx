import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Layers, Lightbulb, Recycle, Sprout } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AIHarvestPrediction, AIWastePrediction, AnalysisScope, Harvest } from '../../types'
import { SourceBadge, confidenceMeaning } from './agentMeta'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { normalizeGrade } from '../batch/GradeBadge'
import { useFarmToday } from '../../hooks/useFarmToday'

import { tr, trEnum } from '../../i18n'
type Tool = 'harvest' | 'waste'
const ICON = { size: 16, strokeWidth: 1.75 } as const

const WASTE_LABEL: Record<string, string> = {
  rotten: tr("Rotten"), damaged: tr("Damaged"), overripe: tr("Overripe"), unused_parts: tr("Unused parts"), other: tr("Other"),
}

/** Whole days from a YYYY-MM-DD date to today (farm calendar), never negative */
function daysBetween(from: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0
}

/** Latest batch of each field, the only field information PineTrack records */
function latestByField(harvests: Harvest[]): Harvest[] {
  const map = new Map<string, Harvest>()
  for (const h of harvests) {
    const prev = map.get(h.field_name)
    if (!prev || h.harvest_date > prev.harvest_date || (h.harvest_date === prev.harvest_date && h.id > prev.id)) map.set(h.field_name, h)
  }
  return [...map.values()].sort((a, b) => a.field_name.localeCompare(b.field_name))
}

const label = 'block text-sm font-medium text-gray-800 mb-1'
const hint = 'mt-1 text-xs text-gray-500'
const card = 'bg-white rounded-xl border border-gray-100 shadow-sm p-5'
const submit = 'w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-medium disabled:opacity-60'

function Slider({ id, text, value, min, max, step, low, high, onChange }: {
  id: string; text: string; value: number; min: number; max: number; step: number; low: string; high: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-gray-800 mb-1">
        {text}<span className="text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-green-700" />
      <div className="flex justify-between text-[11px] text-gray-500"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}

/** Small tag next to a field whose value came from a record; it stays editable */
function FromRecord() {
  return <span className="ml-1.5 rounded bg-green-50 px-1.5 py-px text-[10px] font-medium text-green-800 ring-1 ring-inset ring-green-200">{tr("from records")}</span>
}

function DaysInput({ id, text, value, prefilled, onChange, help }: {
  id: string; text: string; value: number; prefilled: boolean; onChange: (v: number) => void; help: string
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>{text}{prefilled && <FromRecord />}</label>
      <input id={id} type="number" min={0} step={1} inputMode="numeric" value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="w-32 h-10 rounded-lg border border-gray-200 px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-600" />
      <p className={hint}>{help}</p>
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle {...ICON} className="shrink-0 mt-0.5" />{text}</p>
}

function HowWorkedOut({ children }: { children: React.ReactNode }) {
  return (
    <details className="group text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-gray-600 hover:text-gray-900 select-none">
        {tr("How was this worked out?")}
        <ChevronDown {...ICON} size={13} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-700">{children}</div>
    </details>
  )
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 text-center">
      <Lightbulb {...ICON} size={22} className="text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}

// ── Harvest timing ─────────────────────────────────────────────────────────

function HarvestTiming({ harvests, today }: { harvests: Harvest[]; today: string }) {
  const fields = useMemo(() => latestByField(harvests), [harvests])
  const [field, setField] = useState('')
  const [ripeness, setRipeness] = useState(6)
  const [condition, setCondition] = useState(7)
  const [days, setDays] = useState(14)
  const [daysEdited, setDaysEdited] = useState(false)
  const [result, setResult] = useState<AIHarvestPrediction | null>(null)
  const [asked, setAsked] = useState<Harvest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ref = fields.find((f) => f.field_name === field) ?? null
  const recordedDays = ref ? daysBetween(ref.harvest_date, today) : null

  // Fill the days from the field's last recorded harvest, unless the user typed their own value
  useEffect(() => {
    if (recordedDays !== null && !daysEdited) setDays(recordedDays)
  }, [recordedDays, daysEdited])

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ref) { setError(tr("Choose the field to ask about.")); return }
    setLoading(true); setError(''); setResult(null)
    try {
      // The API needs a batch for context; the field's latest batch is the honest reference
      setResult(await apiClient.predictHarvestTiming({
        harvest_id: ref.id, ripeness_level: ripeness, days_since_last_harvest: days, field_condition_score: condition,
      }))
      setAsked(ref)
    } catch (err) {
      setError(apiErrorMessage(err, tr("PineTrack Agent could not respond. Please try again.")))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <form onSubmit={ask} className={`${card} space-y-4`} noValidate>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{tr("When should this field be harvested?")}</h3>
          <p className={hint}>{tr("Tell the agent what the crop looks like today.")}</p>
        </div>
        {error && <ErrorLine text={error} />}

        <div>
          <label htmlFor="ask-field-name" className={label}>{tr("Field")}<span className="text-red-600 ml-0.5" aria-hidden>*</span></label>
          <SearchableSelect id="ask-field-name" value={field} onChange={(v) => { setField(v); setDaysEdited(false) }}
            placeholder={tr("Select a field…")} searchPlaceholder={tr("Search fields")} noResultsText={tr("No fields match")}
            options={fields.map((f) => ({
              value: f.field_name, label: f.field_name, keywords: f.batch_number,
              description: tr("Last harvested {0} · {1}", f.harvest_date, f.batch_number),
            }))} />
          <p className={hint}>
            {fields.length === 0
              ? tr("Fields come from recorded harvests. Record a harvest first.")
              : tr("Fields come from recorded harvests. The latest batch from the field gives the agent its context.")}
          </p>
        </div>

        <DaysInput id="ask-days" text={tr("Days since this field was last harvested")} value={days}
          prefilled={!!ref && !daysEdited} onChange={(v) => { setDays(v); setDaysEdited(true) }}
          help={ref ? tr("Recorded harvest on {0}. Change it if the field was picked since.", ref.harvest_date) : tr("Filled in when you choose a field.")} />

        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{tr("Your observation today")}</p>
        <Slider id="ask-ripe" text={tr("Ripeness (0–10)")} value={ripeness} min={0} max={10} step={0.5} low={tr("Unripe")} high={tr("Fully ripe")} onChange={setRipeness} />
        <Slider id="ask-cond" text={tr("Field condition (0–10)")} value={condition} min={0} max={10} step={0.5} low={tr("Poor")} high={tr("Excellent")} onChange={setCondition} />

        <button type="submit" disabled={loading || fields.length === 0} className={submit}>
          <Lightbulb {...ICON} /> {loading ? tr("Asking the agent…") : tr("Get advice")}
        </button>
      </form>

      {result ? (
        <div className={`${card} space-y-4`} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">{asked ? tr("Advice for {0}", asked.field_name) : tr("Recommendation")}</p>
            <SourceBadge source={result.source ?? 'rules'} model={result.model_version} />
          </div>
          <div>
            <p className="text-xl font-semibold text-gray-900">{tr(result.recommendation)}</p>
            {result.explanation && <p className="mt-1 text-sm text-gray-700 leading-relaxed">{result.explanation}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              <dt className="text-xs text-gray-500">{tr("Expected quality")}</dt>
              <dd className="text-sm font-semibold text-gray-900">{tr(result.quality_prediction)}</dd>
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              <dt className="text-xs text-gray-500">{tr("Transport urgency")}</dt>
              <dd className="text-sm font-semibold text-gray-900">{tr(result.transport_priority)}</dd>
            </div>
          </dl>
          <HowWorkedOut>
            <p>{tr("Inputs: ripeness")} {result.reasoning.ripeness_level}/10 · {result.reasoning.days_since_harvest} {tr("days since last harvest · field condition")} {result.reasoning.field_condition}/10</p>
            {asked && <p>{tr("Context: batch {0} (harvested {1}, grade {2}).", asked.batch_number, asked.harvest_date, trEnum(asked.quality_grade))}</p>}
            <p>{tr("Built-in readiness score for these inputs:")} <span className="font-semibold">{result.reasoning.total_score}/100</span>
              {result.source === 'gemini' ? tr(" (shown for comparison; Gemini made the recommendation)") : ''}</p>
            <p className="text-gray-600">{tr("Confidence")} {Math.round(result.confidence_score * 100)}%. {confidenceMeaning('harvest_timing', result.source ?? 'rules')}</p>
          </HowWorkedOut>
          {asked && <Link to={`/harvest/${asked.id}`} className="inline-block text-sm font-medium text-green-800 hover:underline">{tr("Open batch {0}", asked.batch_number)}</Link>}
        </div>
      ) : <Waiting text={tr("Choose a field, set today's observations and get advice.")} />}
    </div>
  )
}

// ── Waste guidance ─────────────────────────────────────────────────────────

function WasteGuidance({ harvests, today }: { harvests: Harvest[]; today: string }) {
  const [batchId, setBatchId] = useState('')
  const [grade, setGrade] = useState('B')
  const [damage, setDamage] = useState(4)
  const [age, setAge] = useState(5)
  // Values the user set by hand are never replaced by a record's values
  const [edited, setEdited] = useState<{ grade: boolean; age: boolean }>({ grade: false, age: false })
  const [result, setResult] = useState<AIWastePrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const batch = harvests.find((h) => String(h.id) === batchId) ?? null
  const batchGrade = normalizeGrade(batch?.quality_grade)
  const gradeFromRecord = !!batchGrade && !edited.grade
  const ageFromRecord = !!batch && !edited.age

  useEffect(() => {
    if (!batch) return
    if (batchGrade && !edited.grade) setGrade(batchGrade)
    if (!edited.age) setAge(daysBetween(batch.harvest_date, today))
  }, [batch, batchGrade, today, edited])

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      setResult(await apiClient.predictWasteClassification({ quality_grade: grade, damage_level: damage, age_days: age }))
    } catch (err) {
      setError(apiErrorMessage(err, tr("PineTrack Agent could not respond. Please try again.")))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <form onSubmit={ask} className={`${card} space-y-4`} noValidate>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{tr("What should be done with this fruit?")}</h3>
          <p className={hint}>
            {tr("For waste already logged, each record has its own advice in")} <Link to="/waste" className="text-green-800 hover:underline">{tr("Waste Management")}</Link>.
          </p>
        </div>
        {error && <ErrorLine text={error} />}

        <div>
          <label htmlFor="ask-waste-batch" className={label}>{tr("Batch")} <span className="font-normal text-gray-500">{tr("(optional)")}</span></label>
          <SearchableSelect id="ask-waste-batch" value={batchId} onChange={setBatchId}
            placeholder={tr("Not from a specific batch")} searchPlaceholder={tr("Search batch number or field")} noResultsText={tr("No batches match")}
            options={harvests.map((h) => ({
              value: String(h.id), label: h.batch_number, keywords: h.field_name,
              description: `${h.field_name} · ${h.harvest_date}`,
            }))} />
          <p className={hint}>{tr("Choosing a batch fills in its grade and age.")}</p>
        </div>

        <div>
          <p className={label}>{tr("Quality grade")}{gradeFromRecord && <FromRecord />}</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={tr("Quality grade")}>
            {['A', 'B', 'C', 'D'].map((g) => (
              <button key={g} type="button" role="radio" aria-checked={grade === g}
                onClick={() => { setGrade(g); setEdited((p) => ({ ...p, grade: true })) }}
                className={`h-9 rounded-lg text-sm font-semibold border transition-colors ${
                  grade === g ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                {g}
              </button>
            ))}
          </div>
          {batch && !batchGrade && <p className={hint}>{tr("This batch has no single grade recorded; choose the grade of this fruit.")}</p>}
        </div>

        <DaysInput id="ask-age" text={tr("Days since harvest")} value={age} prefilled={ageFromRecord}
          onChange={(v) => { setAge(v); setEdited((p) => ({ ...p, age: true })) }}
          help={batch ? tr("Batch harvested on {0}.", batch.harvest_date) : tr("How long ago the fruit was picked.")} />

        <Slider id="ask-damage" text={tr("Damage you can see (0–10)")} value={damage} min={0} max={10} step={0.5} low={tr("None")} high={tr("Severe")} onChange={setDamage} />

        <button type="submit" disabled={loading} className={submit}>
          <Lightbulb {...ICON} /> {loading ? tr("Asking the agent…") : tr("Get advice")}
        </button>
      </form>

      {result ? (
        <div className={`${card} space-y-4`} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">{tr("Waste type")}</p>
            <SourceBadge source={result.source ?? 'rules'} model={result.model_version} />
          </div>
          <div>
            <p className="text-xl font-semibold text-gray-900">{WASTE_LABEL[result.waste_type] ?? trEnum(result.waste_type)}</p>
            {result.explanation && <p className="mt-1 text-sm text-gray-700 leading-relaxed">{result.explanation}</p>}
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">{tr("Suggested handling")}</p>
            <p className="text-sm font-semibold text-gray-900 capitalize">{trEnum(result.disposal_method)}</p>
          </div>
          <HowWorkedOut>
            <p>{tr("Inputs")}: {tr("Grade")} {result.quality_grade} {tr("· damage")} {result.damage_level}/10 · {result.age_days} {tr("days")}</p>
            <p className="text-gray-600">{tr("Confidence")} {Math.round(result.confidence_score * 100)}%. {confidenceMeaning('waste_classification', result.source ?? 'rules')}</p>
          </HowWorkedOut>
          <Link to="/waste?new=1" className="inline-block text-sm font-medium text-green-800 hover:underline">{tr("Log this as waste")}</Link>
        </div>
      ) : <Waiting text={tr("Set the grade, age and damage, then get advice.")} />}
    </div>
  )
}

// ── Action cards ───────────────────────────────────────────────────────────

function ActionCard({ icon: Icon, title, text, onClick, selected }: {
  icon: React.ElementType; title: string; text: string; onClick: () => void; selected?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`group flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 ${
        selected ? 'border-green-700 ring-1 ring-green-700' : 'border-gray-200 hover:border-green-700'
      }`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800"><Icon {...ICON} size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs text-gray-600">{text}</span>
      </span>
      <ChevronRight {...ICON} size={16} className="mt-1 shrink-0 text-gray-300 group-hover:text-gray-500" />
    </button>
  )
}

/** "What would you like help with?": the tools that fit the selected module */
export default function AskAgent({ scope }: { scope: AnalysisScope }) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [harvests, setHarvests] = useState<Harvest[]>([])
  const { today } = useFarmToday()
  const postHarvest = scope !== 'sulur'

  useEffect(() => {
    if (postHarvest) apiClient.listHarvests(0, 500).then((d) => setHarvests(d.items)).catch(() => setHarvests([]))
  }, [postHarvest])

  // A tool from another module closes when the module changes
  useEffect(() => { if (!postHarvest) setTool(null) }, [postHarvest])

  return (
    <section aria-labelledby="help-heading" className="space-y-3">
      <div>
        <h2 id="help-heading" className="text-base font-semibold text-gray-900">{tr("What would you like help with?")}</h2>
        <p className="text-xs text-gray-500">{tr("Pick a question. The agent answers these questions only; free-text chat is not available.")}</p>
      </div>

      {tool === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {postHarvest && (
            <>
              <ActionCard icon={Sprout} title={tr("When to harvest a field")} onClick={() => setTool('harvest')}
                text={tr("Get a harvest window for a field from today's ripeness and field condition.")} />
              <ActionCard icon={Recycle} title={tr("What to do with waste")} onClick={() => setTool('waste')}
                text={tr("Get the waste type and a handling suggestion for fruit that cannot be sold.")} />
            </>
          )}
          {scope !== 'post_harvest' && (
            // Sulur has no agent question yet; its rule-based planting check lives in the module
            <Link to="/admin/sulur/planner"
              className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-green-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800"><Layers {...ICON} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{tr("Is there enough sulur to plant?")}</span>
                <span className="mt-0.5 block text-xs text-gray-600">{tr("Opens the planting check in Sulur Inventory (built-in rules).")}</span>
              </span>
              <ChevronRight {...ICON} size={16} className="mt-1 shrink-0 text-gray-300 group-hover:text-gray-500" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={() => setTool(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            <ArrowLeft {...ICON} size={15} /> {tr("Choose another question")}
          </button>
          {tool === 'harvest'
            ? <HarvestTiming harvests={harvests} today={today} />
            : <WasteGuidance harvests={harvests} today={today} />}
        </div>
      )}
    </section>
  )
}
