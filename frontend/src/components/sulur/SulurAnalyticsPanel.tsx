import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Layers } from 'lucide-react'
import { SulurAnalytics, SulurPeriodKpis } from '../../types'

/**
 * Sulur Inventory analytics from GET /analytics/sulur. Shows recorded data only:
 * an empty module renders an empty state, never sample figures. Every quantity
 * is a count of sulur pieces and is labelled that way, apart from post-harvest kg.
 */

const COLORS = { available: '#166534', reserved: '#d97706', planted: '#2563eb', sold: '#7c3aed', damage: '#dc2626' }
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }
const pieces = (v: number) => `${v.toLocaleString()} pcs`
const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function change(cur: number, prev: number, higherIsBetter: boolean) {
  const diff = cur - prev
  if (diff === 0) return { text: 'No change', good: true }
  return { text: `${diff > 0 ? '+' : ''}${diff.toLocaleString()} pcs`, good: (diff > 0) === higherIsBetter }
}

export default function SulurAnalyticsPanel({ data, error }: { data: SulurAnalytics | null; error?: string }) {
  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
  }
  if (!data) {
    return <p className="rounded-xl border border-gray-100 bg-white px-5 py-10 text-center text-sm text-gray-500">Loading Sulur analytics…</p>
  }
  if (!data.has_data) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-5 py-10 text-center shadow-sm">
        <Layers size={22} strokeWidth={1.75} className="mx-auto text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-800">No Sulur batches recorded yet</p>
        <p className="mt-1 text-sm text-gray-500">Analytics appear once batches and movements are recorded in Sulur Inventory.</p>
        <Link to="/admin/sulur/stock" className="mt-3 inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-800 hover:border-green-700 hover:bg-green-50/50">
          Open Stock &amp; Batches
        </Link>
      </div>
    )
  }

  const { totals, kpis } = data
  const k = (key: keyof SulurPeriodKpis, higherIsBetter: boolean) => change(kpis.current[key], kpis.previous[key], higherIsBetter)
  const tiles = [
    { label: 'Available sulur', value: pieces(totals.available), sub: `${totals.reserved.toLocaleString()} reserved` },
    { label: 'Certified batches', value: `${data.certified_batches} / ${data.batches}`, sub: `${data.alerts.uncertified_batches} with stock awaiting` },
    { label: `Received, last ${kpis.period_days} days`, value: pieces(kpis.current.stock_in), ...(() => { const c = k('stock_in', true); return { sub: c.text, good: c.good } })() },
    { label: `Planted, last ${kpis.period_days} days`, value: pieces(kpis.current.planted), ...(() => { const c = k('planted', true); return { sub: c.text, good: c.good } })() },
    { label: `Sold, last ${kpis.period_days} days`, value: pieces(kpis.current.sold), ...(() => { const c = k('sold', true); return { sub: c.text, good: c.good } })() },
    { label: `Damaged, last ${kpis.period_days} days`, value: pieces(kpis.current.damaged), ...(() => { const c = k('damaged', false); return { sub: c.text, good: c.good } })() },
  ] as { label: string; value: string; sub: string; good?: boolean }[]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight mb-1">{t.label}</p>
            <p className="text-base font-bold text-gray-900 tabular-nums">{t.value}</p>
            <p className={`text-xs font-medium mt-0.5 ${t.good === undefined ? 'text-gray-500' : t.good ? 'text-green-600' : 'text-red-600'}`}>{t.sub}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-gray-500">
        Period figures compare the last {kpis.period_days} days with the {kpis.period_days} days before. All quantities are {data.unit}.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <Header title="Stock by Variety" sub="Current available, reserved and planted sulur (pieces)" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_variety} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="variety" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [pieces(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="available" name="Available" fill={COLORS.available} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="reserved"  name="Reserved"  fill={COLORS.reserved}  radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="planted"   name="Planted"   fill={COLORS.planted}   radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          {data.by_variety.some((v) => v.below_threshold) && (
            <p className="mt-2 text-xs text-red-700">
              Below minimum stock: {data.by_variety.filter((v) => v.below_threshold)
                .map((v) => `${v.variety} (${v.available.toLocaleString()} of ${v.min_stock_threshold.toLocaleString()})`).join(', ')}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <Header title="Available Stock by Size Grade" sub="Recorded batch grades (pieces)" />
          <ul className="space-y-3">
            {data.by_grade.map((g) => {
              const pct = totals.available ? Math.round((g.available / totals.available) * 100) : 0
              return (
                <li key={g.name}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{g.name} <span className="text-xs text-gray-400">({g.batches} batch{g.batches === 1 ? '' : 'es'})</span></span>
                    <span className="font-semibold tabular-nums text-gray-900">{g.available.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100" aria-hidden>
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS.available }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Treatment status</h4>
          <dl className="space-y-1.5 text-sm">
            {data.by_treatment.map((t) => (
              <div key={t.name} className="flex justify-between">
                <dt className="text-gray-600">{pretty(t.name)}</dt>
                <dd className="tabular-nums text-gray-900">{t.available.toLocaleString()} <span className="text-xs text-gray-400">· {t.batches}</span></dd>
              </div>
            ))}
          </dl>
          {data.alerts.aging_batches > 0 && (
            <p className="mt-3 text-xs text-amber-800">{data.alerts.aging_batches} batch(es) raw or curing for over 14 days.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <Header title="Stock Movements Over Time" sub="Monthly sulur received, planted, sold and damaged (pieces)" />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.movement_trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [pieces(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="stock_in" name="Received" fill={COLORS.available} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="plant"    name="Planted"  fill={COLORS.planted}   radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="sell"     name="Sold"     fill={COLORS.sold}      radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="damage"   name="Damaged"  fill={COLORS.damage}    radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
