import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { Download, AlertTriangle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage, saveBlob } from '../../services/api'
import { AnalyticsOverview, PeriodKpis } from '../../types'

const GRADE_FILL: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
  ungraded: '#94a3b8',
}

interface KpiRow { metric: string; value: string; change: string; positive: boolean }

const CHART_COLORS = {
  primary:   '#22c55e',
  secondary: '#3b82f6',
  tertiary:  '#f59e0b',
  danger:    '#ef4444',
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const RADIAN = Math.PI / 180
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function AnalyticsPage() {
  const [aiMetrics, setAiMetrics] = useState<any>(null)
  const [overview, setOverview]   = useState<AnalyticsOverview | null>(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    apiClient.getAnalyticsOverview(6)
      .then(setOverview)
      .catch((err) => setError(apiErrorMessage(err, 'Failed to load analytics.')))
    apiClient.getAIMetrics()
      .then(setAiMetrics)
      .catch(() => null)
  }, [])

  const handleExport = async (type: string) => {
    try {
      const blob = await apiClient.downloadReport(type)
      saveBlob(blob, `pinetrack-${type}-report.pdf`)
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to generate the report.'))
    }
  }

  // Last 30 days compared with the 30 days before
  const kpiRow = (
    metric: string,
    key: keyof PeriodKpis,
    format: (v: number) => string,
    higherIsBetter: boolean,
    unit: string
  ): KpiRow => {
    const current  = overview?.kpis.current[key] ?? 0
    const previous = overview?.kpis.previous[key] ?? 0
    const diff = Math.round((current - previous) * 10) / 10
    return {
      metric,
      value: format(current),
      change: diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff}${unit}`,
      positive: diff === 0 || (diff > 0) === higherIsBetter,
    }
  }

  const KPI_ROWS: KpiRow[] = [
    kpiRow('Total Harvest Volume',   'harvest_volume_kg',       v => `${v.toLocaleString()} kg`, true,  ' kg'),
    kpiRow('Average Batch Size',     'avg_batch_kg',            v => `${v} kg`,                  true,  ' kg'),
    kpiRow('Grade A Percentage',     'grade_a_percent',         v => `${v}%`,                    true,  ' pts'),
    kpiRow('Waste Rate',             'waste_rate_percent',      v => `${v}%`,                    false, ' pts'),
    kpiRow('Transport On-Time Rate', 'on_time_rate_percent',    v => `${v}%`,                    true,  ' pts'),
    kpiRow('Avg Delivery Delay',     'avg_delivery_delay_days', v => `${v} days`,                false, ' days'),
  ]

  const HARVEST_TREND   = overview?.harvest_trend ?? []
  const TRANSPORT_TREND = overview?.transport_trend ?? []
  const QUALITY_DATA = (overview?.grade_distribution ?? []).map(g => ({
    name: g.grade === 'ungraded' ? 'Ungraded' : `Grade ${g.grade}`,
    value: g.count,
    fill: GRADE_FILL[g.grade] ?? GRADE_FILL.ungraded,
  }))
  const WASTE_BY_TYPE = (overview?.waste_by_type ?? []).map(w => ({
    type: w.type.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()),
    kg: w.kg,
  }))

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Performance insights across all operations</p>
          </div>
          <div className="flex gap-2">
            {['harvest', 'transport', 'waste'].map((type) => (
              <button key={type} onClick={() => handleExport(type)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors capitalize">
                <Download size={13} /> {type}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {KPI_ROWS.map((kpi) => (
            <div key={kpi.metric} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight mb-1">{kpi.metric}</p>
              <p className="text-base font-bold text-gray-900">{kpi.value}</p>
              <p className={`text-xs font-medium mt-0.5 ${kpi.positive ? 'text-green-600' : 'text-red-600'}`}>{kpi.change}</p>
            </div>
          ))}
        </div>

        {/* Row 1: Harvest trend + Quality distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Harvest Volume Over Time" sub="Monthly volume in kg and batch count" />
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={HARVEST_TREND} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="kg" name="Volume (kg)" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#g1)" />
                <Line yAxisId="right" type="monotone" dataKey="batches" name="Batches" stroke={CHART_COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Quality Grade Distribution" sub="Share of harvest batches, last 6 months" />
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={QUALITY_DATA}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                  label={renderLabel}
                >
                  {QUALITY_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} batches`, 'Count']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2: Waste by type + Transport trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Waste by Type" sub="Total kg per waste category, last 6 months" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={WASTE_BY_TYPE} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v} kg`, 'Waste']} />
                <Bar dataKey="kg" name="Waste (kg)" radius={[4, 4, 0, 0]}>
                  {WASTE_BY_TYPE.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.danger, CHART_COLORS.tertiary, '#f97316', CHART_COLORS.secondary, '#8b5cf6'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Transport Performance" sub="Monthly on-time vs late or overdue deliveries" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={TRANSPORT_TREND} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="delivered" name="On time" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="delayed"   name="Delayed"   fill={CHART_COLORS.danger}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Metrics */}
        {aiMetrics && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <SectionHeader title="PineTrack Agent Activity" sub="How often the agent has been used" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">Total Predictions</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{aiMetrics.total_predictions}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">Avg Confidence</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {Math.round(aiMetrics.average_confidence * 100)}%
                </p>
              </div>
              {aiMetrics.by_prediction_type && Object.entries(aiMetrics.by_prediction_type).slice(0, 2).map(([type, count]) => (
                <div key={type} className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide capitalize">{type.replace('_', ' ')}</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{count as number}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHeader title="Key Performance Indicators" sub="Last 30 days, with change against the 30 days before" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Metric</th>
                <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Value</th>
                <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Change</th>
              </tr>
            </thead>
            <tbody>
              {KPI_ROWS.map((row, i) => (
                <tr key={row.metric} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-5 py-3 text-gray-700 font-medium">{row.metric}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">{row.value}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${row.positive ? 'text-green-600' : 'text-red-600'}`}>
                      {row.change}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}

