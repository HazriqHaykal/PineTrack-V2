import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, RefreshCw, X } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AILog, AIMetrics, AIStatus } from '../../types'
import { PREDICTION_LABEL, SourceBadge, Source, confidenceMeaning, formatWhen, isRecommendationSet, modelName, predictionLabel, sourceOf } from './agentMeta'
import AppSelect from '../../components/ui/AppSelect'

import { tr, trEnum } from '../../i18n'
const PAGE = 500
const BRAND_GREEN = '#2d6a4f'
const ROUTE_LABEL: Record<string, string> = {
  processing: tr("Processing"), low_grade: tr("Low-grade processing"), feed: tr("Animal feed"),
  compost: tr("Compost"), dispose: tr("Safe disposal"), review: tr("Manual review"),
}
const WASTE_LABEL: Record<string, string> = {
  rotten: tr("Rotten"), damaged: tr("Damaged"), overripe: tr("Overripe"), unused_parts: tr("Unused parts"), other: tr("Other"),
}

/** Local calendar date of a timestamp, for the date filter */
const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A readable one-line result for each stored prediction type */
function resultText(log: AILog): string {
  if (log.prediction_type === 'waste_classification') return tr("Classified as {0}", WASTE_LABEL[log.prediction_result] ?? log.prediction_result)
  return log.prediction_result
}

/** The stored inputs and outputs, shown when a row is expanded; nothing is inferred */
function LogDetails({ log }: { log: AILog }) {
  const d = log.input_data as Record<string, any>
  const source: Source = (d?.source as Source) ?? sourceOf(log.model_version)
  let body: React.ReactNode = null

  if (log.prediction_type === 'harvest_timing') {
    body = <p>{tr("Inputs: ripeness")} {d.ripeness_level}/10 · {d.days_since_last_harvest} {tr("days since last harvest · field condition")} {d.field_condition_score}/10</p>
  } else if (log.prediction_type === 'waste_classification') {
    body = <p>{tr("Inputs: grade")} {d.quality_grade} {tr("· damage")} {d.damage_level}/10 · {d.age_days} {tr("days old")}</p>
  } else if (log.prediction_type === 'waste_analysis') {
    const r = d.result ?? {}
    body = (
      <>
        <p>{tr("Waste record #")}{d.waste_id} · {ROUTE_LABEL[r.route] ?? r.route}</p>
        {r.explanation && <p className="mt-1">{r.explanation}</p>}
      </>
    )
  } else if (isRecommendationSet(log.prediction_type)) {
    const items: { title: string; priority: string }[] = Array.isArray(d.items) ? d.items : []
    const batches = d.snapshot?.harvest?.batches
    const sulurBatches = d.snapshot?.sulur?.batches
    body = (
      <>
        {typeof batches === 'number' && <p>{tr("Post-harvest, last")} {d.snapshot.period_days} {tr("days:")} {batches} {tr("harvest batch")}{batches === 1 ? '' : 'es'}, {d.snapshot.waste?.records ?? 0} {tr("waste records.")}</p>}
        {typeof sulurBatches === 'number' && <p>{tr("Sulur Inventory:")} {sulurBatches} {tr("batch")}{sulurBatches === 1 ? '' : 'es'}, {(d.snapshot.sulur.totals?.available ?? 0).toLocaleString()} {tr("sulur available.")}</p>}
        {items.length > 0
          ? <ul className="mt-1 list-disc pl-4 space-y-0.5">{items.map((i, n) => <li key={n}>{i.title} <span className="text-gray-500">({trEnum(i.priority)})</span></li>)}</ul>
          : <p className="mt-1">{tr("No recommendations in this set.")}</p>}
      </>
    )
  }

  return (
    <div className="space-y-2 text-xs text-gray-700">
      {body}
      <p className="text-gray-500">{tr("Model:")} {modelName(log.model_version)}</p>
      {log.confidence_score != null && (
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">
            {tr("Confidence")} {Math.round(log.confidence_score * 100)}%{isRecommendationSet(log.prediction_type) ? tr(" (average of the set)") : ''}.
          </span>{' '}
          {confidenceMeaning(log.prediction_type, source)}
        </p>
      )}
    </div>
  )
}

export default function AgentHistory({ status, metrics }: { status: AIStatus | null; metrics: AIMetrics | null }) {
  const [logs, setLogs] = useState<AILog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const [typeF, setTypeF] = useState('all')
  const [sourceF, setSourceF] = useState<'all' | Source>('all')
  const [fromF, setFromF] = useState('')
  const [toF, setToF] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getAILogs(0, PAGE)
      setLogs(res.items)
      setTotal(res.total)
      setError(null)
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not load the activity history")))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = logs.filter((l) => {
    const day = localDay(l.created_at)
    return (typeF === 'all' || l.prediction_type === typeF)
      && (sourceF === 'all' || sourceOf(l.model_version) === sourceF)
      && (!fromF || day >= fromF) && (!toF || day <= toF)
  })
  const filtersActive = typeF !== 'all' || sourceF !== 'all' || !!fromF || !!toF
  const clear = () => { setTypeF('all'); setSourceF('all'); setFromF(''); setToF('') }
  const types = Array.from(new Set([...Object.keys(PREDICTION_LABEL), ...Object.keys(metrics?.by_prediction_type ?? {})]))

  const byType = Object.entries(metrics?.by_prediction_type ?? {}).sort((a, b) => b[1] - a[1])
  const maxType = Math.max(1, ...byType.map(([, n]) => n))
  const control = (active: boolean) =>
    `h-9 px-2.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600 ${active ? 'border-green-600 text-gray-900' : 'border-gray-200 text-gray-700'}`

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm min-w-0">
        <div className="flex flex-col gap-3 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{tr("Activity history")}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{tr("Every saved agent answer, newest first")}</p>
            </div>
            <button onClick={load} disabled={loading} aria-label={tr("Reload history")} title={tr("Reload")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-60">
              <RefreshCw size={15} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <AppSelect size="sm" aria-label={tr("Category")} value={typeF} onChange={setTypeF} highlighted={typeF !== 'all'}
              triggerClassName="w-auto min-w-[10rem]"
              options={[{ value: 'all', label: tr("All categories") }, ...types.map((t) => ({ value: t, label: predictionLabel(t) }))]} />
            <AppSelect size="sm" aria-label={tr("Source")} value={sourceF} onChange={(v) => setSourceF(v as 'all' | Source)}
              highlighted={sourceF !== 'all'} triggerClassName="w-auto min-w-[10rem]"
              options={[
                { value: 'all', label: tr("Gemini and rules") },
                { value: 'gemini', label: tr("Gemini only") },
                { value: 'rules', label: tr("Built-in rules only") },
              ]} />
            <label className="flex items-center gap-1.5 text-xs text-gray-600">{tr("From")}
              <input type="date" value={fromF} onChange={(e) => setFromF(e.target.value)} className={control(!!fromF)} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">{tr("To")}
              <input type="date" value={toF} onChange={(e) => setToF(e.target.value)} className={control(!!toF)} />
            </label>
            {filtersActive && (
              <button onClick={clear} className="h-9 inline-flex items-center gap-1 px-1 text-xs font-medium text-gray-600 hover:text-gray-900">
                <X size={13} /> {tr("Clear")}
              </button>
            )}
          </div>
        </div>

        {total > logs.length && (
          <p className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {tr("Showing the latest")} {logs.length} {tr("of")} {total} {tr("entries; filters apply to these.")}
          </p>
        )}

        {loading && logs.length === 0 ? (
          <p className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">{tr("Loading history…")}</p>
        ) : error ? (
          <div className="border-t border-gray-100 px-5 py-10 text-center">
            <AlertTriangle size={26} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-700">{error}</p>
            <button onClick={load} className="mt-2 text-sm font-medium text-green-800 hover:underline">{tr("Try again")}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-t border-gray-100 px-5 py-10 text-center">
            <p className="text-sm font-medium text-gray-800">{logs.length === 0 ? tr("No agent activity yet") : tr("No entries match these filters")}</p>
            {logs.length > 0 && <button onClick={clear} className="mt-1 text-sm font-medium text-green-800 hover:underline">{tr("Clear filters")}</button>}
          </div>
        ) : (
          <ul className="border-t border-gray-100 divide-y divide-gray-100">
            {filtered.map((log) => {
              const expanded = open === log.id
              const src = sourceOf(log.model_version)
              return (
                <li key={log.id}>
                  <button onClick={() => setOpen(expanded ? null : log.id)} aria-expanded={expanded}
                    className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-gray-900">{predictionLabel(log.prediction_type)}</span>
                        <SourceBadge source={src} model={log.model_version} />
                      </div>
                      <p className="mt-0.5 text-sm text-gray-700 truncate">{resultText(log)}</p>
                    </div>
                    <time dateTime={log.created_at} className="shrink-0 text-xs text-gray-500 tabular-nums pt-0.5">{formatWhen(log.created_at)}</time>
                    <ChevronDown size={15} strokeWidth={1.75} className={`shrink-0 mt-0.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="px-5 pb-3 -mt-0.5">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <LogDetails log={log} />
                        {log.harvest_id && (
                          <Link to={`/harvest/${log.harvest_id}`} className="mt-2 inline-block text-xs font-medium text-green-800 hover:underline">{tr("Open the related batch")}</Link>
                        )}
                        {log.prediction_type === 'waste_analysis' && (
                          <Link to="/waste" className="mt-2 ml-3 inline-block text-xs font-medium text-green-800 hover:underline">{tr("Open Waste Management")}</Link>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {filtersActive && filtered.length > 0 && (
          <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">{tr("Showing")} {filtered.length} {tr("of")} {logs.length} {tr("entries")}</p>
        )}
      </section>

      <div className="space-y-4">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{tr("Predictions by type")}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{tr("All time ·")} {metrics?.total_predictions ?? 0} {tr("in total")}</p>
          {byType.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{tr("No predictions yet.")}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {byType.map(([type, n]) => (
                <li key={type}>
                  <button onClick={() => setTypeF(typeF === type ? 'all' : type)} className="w-full text-left group">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className={`truncate ${typeF === type ? 'font-semibold text-green-900' : 'text-gray-800 group-hover:text-gray-900'}`}>{predictionLabel(type)}</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${(n / maxType) * 100}%`, background: BRAND_GREEN }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="group bg-white rounded-xl border border-gray-100 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-900">
            {tr("Agent details")}
            <ChevronDown size={15} strokeWidth={1.75} className="text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-gray-100 px-5 py-4 space-y-3 text-xs text-gray-700">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-gray-500">{tr("Engine now")}</dt>
              <dd>{status ? (status.gemini_configured ? tr("Gemini") : tr("Built-in rules")) : '—'}</dd>
              <dt className="text-gray-500">{tr("Model")}</dt>
              <dd className="break-words">{status ? modelName(status.model) : '—'}</dd>
              <dt className="text-gray-500">{tr("Fallback")}</dt>
              <dd>{tr("Built-in rules answer whenever Gemini is unavailable or gives an invalid answer.")}</dd>
            </dl>
            {status && !status.gemini_configured && (
              <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-600">
                {tr("Gemini is not configured on the server, so all answers come from the built-in rules. A system administrator can enable Gemini in the server configuration.")}
              </p>
            )}
            {metrics && Object.keys(metrics.by_model_version).length > 0 && (
              <div>
                <p className="text-gray-500 mb-1">{tr("Answers by engine (all time)")}</p>
                <ul className="space-y-0.5">
                  {Object.entries(metrics.by_model_version).map(([m, n]) => (
                    <li key={m} className="flex justify-between gap-2"><span>{modelName(m)}</span><span className="tabular-nums font-medium">{n}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
