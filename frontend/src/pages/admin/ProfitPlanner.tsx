import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ChevronRight, History, Info, Scale, Target, TrendingUp } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { HistoricalYield, PlannerInput, PlannerMode, PlannerResult, WhatIfResult } from '../../types'

import { tr, locale } from '../../i18n'
// ── Formatting ───────────────────────────────────────────────────────────────

const num = (n: number, digits = 2) => n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits })
const rm = (n: number) => `${n < 0 ? '−' : ''}RM ${Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const kg = (n: number) => `${num(n)} kg`
const ha = (n: number) => `${num(n, 3)} ha`
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

// ── Inputs ───────────────────────────────────────────────────────────────────

type FieldKey =
  | 'target_profit' | 'planned_harvest_kg' | 'land_area_ha'
  | 'selling_price_per_kg' | 'variable_cost_per_kg' | 'fixed_cost'
  | 'marketable_yield_percent' | 'productivity_kg_per_ha'

type Values = Record<FieldKey, string>
type Errors = Partial<Record<FieldKey, string>>

// No prices or costs are prefilled: they must come from the farm, not from the app
const EMPTY: Values = {
  target_profit: '', planned_harvest_kg: '', land_area_ha: '',
  selling_price_per_kg: '', variable_cost_per_kg: '', fixed_cost: '',
  marketable_yield_percent: '', productivity_kg_per_ha: '',
}

type Basis = 'harvest' | 'land'

/**
 * Basic checks so obviously incomplete input is not sent. The backend
 * validates again and is the only place anything is calculated.
 */
function buildInput(mode: PlannerMode, basis: Basis, v: Values): { input: PlannerInput | null; errors: Errors } {
  const errors: Errors = {}
  const read = (key: FieldKey, rule: 'positive' | 'nonnegative' | 'percent'): number | undefined => {
    const raw = v[key].trim()
    if (raw === '') return undefined
    const n = Number(raw)
    if (!Number.isFinite(n)) errors[key] = tr("Enter a number")
    else if (rule === 'positive' && n <= 0) errors[key] = tr("Must be greater than 0")
    else if (rule === 'nonnegative' && n < 0) errors[key] = tr("Cannot be negative")
    else if (rule === 'percent' && (n <= 0 || n > 100)) errors[key] = tr("Between 0 and 100")
    return n
  }
  const price = read('selling_price_per_kg', 'positive')
  const variable = read('variable_cost_per_kg', 'nonnegative')
  const fixed = read('fixed_cost', 'nonnegative')
  const yieldPct = read('marketable_yield_percent', 'percent')
  const productivity = read('productivity_kg_per_ha', 'positive')
  const target = mode === 'target_profit' ? read('target_profit', 'nonnegative') : undefined
  const harvest = mode === 'forecast' && basis === 'harvest' ? read('planned_harvest_kg', 'positive') : undefined
  const land = mode === 'forecast' && basis === 'land' ? read('land_area_ha', 'positive') : undefined

  const required = [price, variable, fixed, yieldPct, productivity,
    mode === 'target_profit' ? target : basis === 'harvest' ? harvest : land]
  if (Object.keys(errors).length || required.some((x) => x === undefined)) return { input: null, errors }
  return {
    errors,
    input: {
      mode,
      selling_price_per_kg: price!, variable_cost_per_kg: variable!, fixed_cost: fixed!,
      marketable_yield_percent: yieldPct!, productivity_kg_per_ha: productivity!,
      ...(mode === 'target_profit' ? { target_profit: target } : basis === 'harvest' ? { planned_harvest_kg: harvest } : { land_area_ha: land }),
    },
  }
}

function NumberField({ id, label, unit, value, onChange, error, hint }: {
  id: string; label: string; unit: string; value: string; onChange: (v: string) => void; error?: string; hint?: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className={`flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-green-500 ${error ? 'border-red-300' : 'border-gray-200'}`}>
        <input
          id={id} type="number" inputMode="decimal" min="0" step="any" value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
        />
        <span className="pr-3 text-xs text-gray-500 whitespace-nowrap">{unit}</span>
      </div>
      {error ? <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p> : hint}
    </div>
  )
}

function Card({ title, icon: Icon, children, className = '' }: {
  title: string; icon?: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
        {Icon && <Icon size={15} className="text-gray-500" />}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ── Historical yield ─────────────────────────────────────────────────────────

function HistoryHint({ history, error, onUse, inUse }: {
  history: HistoricalYield | null; error: string; onUse: () => void; inUse: boolean
}) {
  if (error) return <p className="mt-1 text-xs text-gray-500">{error}</p>
  if (!history) return <p className="mt-1 text-xs text-gray-400">{tr("Checking recorded grading…")}</p>
  if (!history.available) {
    return <p className="mt-1 text-xs text-gray-500" title={history.rules}>{history.message}</p>
  }
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-2 text-xs text-gray-700">
      <History size={13} className="shrink-0 mt-0.5 text-gray-500" />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-semibold text-gray-900">{history.marketable_yield_percent}%</span> {tr("historical yield from")}{' '}
          {history.included_batches} {tr("graded batches (")}{formatDate(history.period_start)} – {formatDate(history.period_end)})
        </p>
        <p className="text-gray-500 mt-0.5" title={history.rules}>
          {tr("Weighted by quantity")}
          {history.excluded_legacy_batches + history.excluded_ungraded_batches > 0 &&
            tr("; {0} legacy or ungraded batch(es) excluded", history.excluded_legacy_batches + history.excluded_ungraded_batches)}
        </p>
      </div>
      {inUse ? (
        <span className="shrink-0 font-medium text-green-800">{tr("In use")}</span>
      ) : (
        <button type="button" onClick={onUse} className="shrink-0 font-medium text-green-700 hover:underline">{tr("Use")}</button>
      )}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

const tone = (n: number) => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'zero')

function Results({ r }: { r: PlannerResult }) {
  const t = tone(r.profit)
  const profitBox = {
    positive: 'bg-green-800 text-white',
    negative: 'bg-red-50 border border-red-200 text-red-900',
    zero: 'bg-white border border-gray-200 text-gray-900',
  }[t]
  const metrics = [
    { label: r.mode === 'target_profit' ? tr("Harvest required") : tr("Harvest quantity"), value: kg(r.harvest_kg) },
    { label: tr("Marketable quantity"), value: kg(r.marketable_kg) },
    { label: r.harvest_source === 'land_area' ? tr("Land used") : tr("Land required"), value: ha(r.land_ha) },
    { label: tr("Revenue"), value: rm(r.revenue) },
    { label: tr("Total costs"), value: rm(r.total_cost) },
  ]
  const chart = [
    { name: tr("Revenue"), value: r.revenue, fill: '#166534' },
    { name: tr("Total costs"), value: r.total_cost, fill: '#9ca3af' },
    { name: tr("Profit"), value: r.profit, fill: r.profit < 0 ? '#dc2626' : r.profit > 0 ? '#16a34a' : '#6b7280' },
  ]

  return (
    <div className="space-y-4">
      <div className={`rounded-xl px-5 py-4 ${profitBox}`}>
        <p className={`text-xs font-medium uppercase tracking-wide ${t === 'positive' ? 'text-green-50' : 'text-gray-600'}`}>{tr("Expected profit")}</p>
        <p className="text-3xl font-bold tabular-nums mt-0.5">{rm(r.profit)}</p>
        <p className={`text-xs mt-1 ${t === 'positive' ? 'text-green-50' : 'text-gray-600'}`}>
          {r.profit_margin_percent != null ? tr("Profit margin {0}%", r.profit_margin_percent) : tr("Profit margin not defined (no revenue)")}
          {r.break_even_marketable_kg != null && tr(" · Break-even at {0} marketable", kg(r.break_even_marketable_kg))}
        </p>
      </div>

      {/* Cards wrap onto new rows instead of shrinking, so figures are never cut off */}
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 min-w-0">
            <dt className="text-xs text-gray-500">{m.label}</dt>
            <dd className="text-lg font-semibold text-gray-900 tabular-nums mt-0.5 leading-snug break-words">{m.value}</dd>
          </div>
        ))}
      </dl>

      {r.notes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
          {r.notes.map((n) => (
            <p key={n} className="flex gap-2 text-sm text-amber-900"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{n}</p>
          ))}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">{tr("Financial breakdown")}</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={64}
                tickFormatter={(v: number) => `RM ${Math.abs(v) >= 1000 ? `${num(v / 1000, 1)}k` : num(v, 0)}`} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [rm(Number(v)), '']} separator="" />
              <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={64}>
                {chart.map((d) => <Cell key={d.name} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details className="group rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <summary className="flex items-center gap-2 cursor-pointer list-none font-medium text-gray-800">
          {tr("How was this calculated?")}
          <ChevronRight size={15} className="ml-auto text-gray-500 transition-transform group-open:rotate-90" />
        </summary>
        <ol className="mt-3 space-y-2.5">
          {r.steps.map((s) => (
            <li key={s.label}>
              <p className="font-medium text-gray-900">{tr(s.label)}</p>
              <p className="text-xs text-gray-500">{s.formula}</p>
              <p className="text-xs text-gray-800 tabular-nums mt-0.5 break-words">{s.working}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-xs text-gray-600 list-disc pl-4">
          <li>{tr("Variable cost is charged per marketable kg, not per harvested kg or per hectare.")}</li>
          <li>{tr("Money is rounded to RM 0.01, quantities to 0.01 kg and land to 0.001 ha.")}
            {r.mode === 'target_profit' && tr(" Required quantities and land are rounded up so the target is still met.")}</li>
          <li>{tr("Calculation version")} {r.calculation_version}{tr(". Nothing is saved, and no farm records are changed.")}</li>
        </ul>
      </details>
    </div>
  )
}

// ── What-if scenarios ────────────────────────────────────────────────────────

const SCENARIO_STYLE: Record<string, string> = {
  Conservative: 'text-gray-700',
  Expected: 'text-green-800',
  Optimistic: 'text-gray-700',
}

const ASSUMPTION_FORMAT: Record<string, (n: number) => string> = {
  selling_price_per_kg: (n) => `RM ${num(n, 4)}`,
  variable_cost_per_kg: (n) => `RM ${num(n, 4)}`,
  fixed_cost: rm,
  marketable_yield_percent: (n) => `${num(n)}%`,
  productivity_kg_per_ha: (n) => `${num(n)} kg/ha`,
}

/**
 * Optional sensitivity check: the backend derives Conservative and Optimistic
 * versions of the current plan with fixed, documented rules, and calculates all
 * three with the same service as the main result.
 */
function WhatIfScenarios({ input, mode }: { input: PlannerInput | null; mode: PlannerMode }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<WhatIfResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !input) { setData(null); setError(''); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setData(await apiClient.getWhatIf(input, controller.signal))
        setError('')
      } catch (err) {
        if (!controller.signal.aborted) setError(apiErrorMessage(err, tr("Could not calculate the scenarios")))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, input])

  const target = mode === 'target_profit'
  const rows: { label: string; get: (r: PlannerResult) => string; strong?: boolean }[] = [
    { label: target ? tr("Harvest required") : tr("Harvest quantity"), get: (r) => kg(r.harvest_kg) },
    { label: target ? tr("Land required") : tr("Land"), get: (r) => ha(r.land_ha) },
    { label: tr("Estimated revenue"), get: (r) => rm(r.revenue) },
    { label: tr("Total costs"), get: (r) => rm(r.total_cost) },
    { label: tr("Expected profit"), get: (r) => rm(r.profit), strong: true },
  ]

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="what-if-panel"
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        <Scale size={15} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-900">{tr("Explore What-If Scenarios")}</span>
        <span className="text-xs text-gray-500">{tr("(Optional)")}</span>
        <ChevronRight size={16} className={`ml-auto text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div id="what-if-panel" className="border-t border-gray-100 p-5 space-y-4">
          <p className="text-xs text-gray-600 max-w-3xl">
            {target
              ? tr("The same target profit under less and more favourable assumptions: how much harvest and land each would need.")
              : tr("The same planned harvest under less and more favourable assumptions: how the profit would change.")}
            {' '}{tr("Expected is your current plan. These are hypothetical adjustments, not predictions or guarantees.")}
          </p>

          {!input ? (
            <p className="text-sm text-gray-500">{tr("Complete the planning inputs above to generate the scenarios.")}</p>
          ) : error ? (
            <p className="flex gap-2 text-sm text-red-700"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</p>
          ) : !data ? (
            <p className="text-sm text-gray-400">{tr("Calculating scenarios…")}</p>
          ) : (
            <div className={loading ? 'opacity-70 transition-opacity' : ''}>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-xs">
                      <th className="text-left font-medium text-gray-500 py-2 pr-3">{tr("Estimate")}</th>
                      {data.scenarios.map((s) => (
                        <th key={s.label} scope="col"
                          className={`text-right font-semibold py-2 px-2 ${SCENARIO_STYLE[s.label] ?? ''} ${s.label === 'Expected' ? 'bg-green-50 rounded-t-lg' : ''}`}>
                          {s.label}{s.label === 'Expected' && <span className="block text-[10px] font-normal text-gray-500">{tr("your inputs")}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label} className="border-t border-gray-100">
                        <th scope="row" className={`text-left py-2 pr-3 whitespace-nowrap ${row.strong ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
                          {row.label}
                        </th>
                        {data.scenarios.map((s) => {
                          const r = s.result
                          const profitTone = row.strong && r ? (r.profit > 0 ? 'text-green-800' : r.profit < 0 ? 'text-red-700' : '') : ''
                          return (
                            <td key={s.label} className={`py-2 px-2 text-right tabular-nums ${row.strong ? 'font-semibold' : ''} ${profitTone} ${s.label === 'Expected' ? 'bg-green-50' : ''}`}>
                              {r ? row.get(r) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.scenarios.filter((s) => s.error).map((s) => (
                <p key={s.label} className="mt-3 flex gap-2 text-xs text-amber-900">
                  <AlertTriangle size={13} className="shrink-0 mt-px" /><span><span className="font-semibold">{s.label}:</span> {s.error}</span>
                </p>
              ))}

              <details className="group mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <summary className="flex items-center gap-2 cursor-pointer list-none font-medium text-gray-800">
                  {tr("View Assumptions")}
                  <ChevronRight size={15} className="ml-auto text-gray-500 transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-medium py-1.5 pr-3">{tr("Assumption")}</th>
                        {data.scenarios.map((s) => <th key={s.label} className="text-right font-medium py-1.5 px-2">{s.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rules.map((rule) => (
                        <tr key={rule.field} className="border-t border-gray-200">
                          <th scope="row" className="text-left font-normal text-gray-700 py-1.5 pr-3">{rule.label}</th>
                          {data.scenarios.map((s) => {
                            const change = s.label === 'Conservative' ? rule.conservative : s.label === 'Optimistic' ? rule.optimistic : null
                            const value = s.inputs[rule.field]
                            return (
                              <td key={s.label} className="text-right py-1.5 px-2 tabular-nums text-gray-900">
                                {value != null ? (ASSUMPTION_FORMAT[rule.field] ?? num)(value) : '—'}
                                {change && <span className="block text-[10px] text-gray-500">{change}</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-gray-600 list-disc pl-4">
                  <li>{tr("Prices, costs and productivity change by a percentage of your input; marketable yield changes by percentage points and stays between 1% and 100%.")}</li>
                  <li>{target ? tr("The target profit") : tr("The planned harvest or land area")} {tr("is the same in every scenario.")}</li>
                  <li>{tr("Each scenario is calculated with the same formulas as the main result.")}</li>
                  <li>{data.note}</li>
                </ul>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfitPlanner() {
  const [mode, setMode] = useState<PlannerMode>('target_profit')
  const [basis, setBasis] = useState<Basis>('harvest')
  const [values, setValues] = useState<Values>(EMPTY)
  const [history, setHistory] = useState<HistoricalYield | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [result, setResult] = useState<PlannerResult | null>(null)
  const [calcError, setCalcError] = useState('')
  const [calculating, setCalculating] = useState(false)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    apiClient.getHistoricalYield(12)
      .then((h) => {
        setHistory(h)
        // Offer the recorded yield as the starting assumption; it can be overwritten
        if (h.available && h.marketable_yield_percent != null) {
          setValues((v) => (v.marketable_yield_percent ? v : { ...v, marketable_yield_percent: String(h.marketable_yield_percent) }))
        }
      })
      .catch((err) => setHistoryError(apiErrorMessage(err, tr("Historical yield could not be loaded. Enter the yield manually."))))
  }, [])

  const set = (key: FieldKey) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }))
  const { input, errors } = useMemo(() => buildInput(mode, basis, values), [mode, basis, values])

  // Results always come from the backend; recalculated shortly after the inputs settle
  useEffect(() => {
    if (!input) { setResult(null); setCalcError(''); return }
    const timer = setTimeout(async () => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setCalculating(true)
      try {
        setResult(await apiClient.calculatePlan(input, controller.signal))
        setCalcError('')
      } catch (err) {
        if (controller.signal.aborted) return
        setResult(null)
        setCalcError(apiErrorMessage(err, tr("Could not calculate this plan")))
      } finally {
        if (!controller.signal.aborted) setCalculating(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [input])

  const historyInUse = !!history?.available && values.marketable_yield_percent === String(history.marketable_yield_percent)

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr("Harvest & Profit Planner")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tr("Plan pineapple harvest requirements and estimate financial outcomes.")}</p>
        </div>

        {/* Mode selector */}
        <div role="tablist" aria-label={tr("Planning mode")} className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {([
            ['target_profit', tr("Target Profit"), Target],
            ['forecast', tr("Harvest Forecast"), TrendingUp],
          ] as const).map(([m, label, Icon]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-green-700 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
          {/* Inputs */}
          <div className="space-y-6">
            <Card title={tr("Financial inputs")}>
              <div className="space-y-4">
                {mode === 'target_profit' ? (
                  <NumberField id="target_profit" label={tr("Target profit")} unit="RM" value={values.target_profit}
                    onChange={set('target_profit')} error={errors.target_profit} />
                ) : (
                  <div className="space-y-2">
                    <div role="radiogroup" aria-label={tr("Plan from")} className="flex gap-4 text-sm">
                      {([['harvest', tr("Planned harvest")], ['land', tr("Available land")]] as const).map(([b, label]) => (
                        <label key={b} className="inline-flex items-center gap-1.5 text-gray-700">
                          <input type="radio" name="basis" checked={basis === b} onChange={() => setBasis(b)} className="accent-green-700" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {basis === 'harvest' ? (
                      <NumberField id="planned_harvest_kg" label={tr("Planned harvest quantity")} unit="kg" value={values.planned_harvest_kg}
                        onChange={set('planned_harvest_kg')} error={errors.planned_harvest_kg} />
                    ) : (
                      <NumberField id="land_area_ha" label={tr("Available land area")} unit="ha" value={values.land_area_ha}
                        onChange={set('land_area_ha')} error={errors.land_area_ha} />
                    )}
                  </div>
                )}
                <NumberField id="selling_price_per_kg" label={tr("Average selling price")} unit="RM / kg" value={values.selling_price_per_kg}
                  onChange={set('selling_price_per_kg')} error={errors.selling_price_per_kg} />
                <NumberField id="variable_cost_per_kg" label={tr("Variable cost per marketable kg")} unit="RM / kg" value={values.variable_cost_per_kg}
                  onChange={set('variable_cost_per_kg')} error={errors.variable_cost_per_kg}
                  hint={<p className="mt-1 text-xs text-gray-500">{tr("E.g. packing and handling for each kilogram sold.")}</p>} />
                <NumberField id="fixed_cost" label={tr("Fixed operational cost")} unit="RM" value={values.fixed_cost}
                  onChange={set('fixed_cost')} error={errors.fixed_cost} />
              </div>
            </Card>

            <Card title={tr("Harvest assumptions")}>
              <div className="space-y-4">
                <NumberField id="marketable_yield_percent" label={tr("Expected marketable yield")} unit="%" value={values.marketable_yield_percent}
                  onChange={set('marketable_yield_percent')} error={errors.marketable_yield_percent}
                  hint={<HistoryHint history={history} error={historyError} inUse={historyInUse}
                    onUse={() => history?.marketable_yield_percent != null && set('marketable_yield_percent')(String(history.marketable_yield_percent))} />} />
                <NumberField id="productivity_kg_per_ha" label={tr("Expected productivity")} unit="kg / ha" value={values.productivity_kg_per_ha}
                  onChange={set('productivity_kg_per_ha')} error={errors.productivity_kg_per_ha}
                  hint={<p className="mt-1 text-xs text-gray-500">{tr("Harvested weight per hectare, before grading.")}</p>} />
              </div>
            </Card>
          </div>

          {/* Results */}
          <Card title={tr("Estimated results")} icon={Info} className="min-w-0">
            <div aria-live="polite" className={calculating ? 'opacity-70 transition-opacity' : ''}>
              {calcError ? (
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />{calcError}
                </div>
              ) : result ? (
                <Results r={result} />
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-center text-gray-500">
                  <Scale size={28} className="mb-2 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">{tr("Enter every planning input to see the estimate")}</p>
                  <p className="text-xs mt-1 max-w-sm">
                    {mode === 'target_profit'
                      ? tr("Find out how much to harvest, and on how much land, to reach a profit target.")
                      : tr("See the expected revenue, costs and profit of a planned harvest.")}
                  </p>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">
                {result?.disclaimer ?? tr("Planning estimate only, based on the assumptions entered. Not a guaranteed financial result.")}
              </p>
            </div>
          </Card>
        </div>

        <WhatIfScenarios input={input} mode={mode} />
      </div>
    </AdminLayout>
  )
}
