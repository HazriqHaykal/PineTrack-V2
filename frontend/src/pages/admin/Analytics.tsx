import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { Download } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient } from '../../services/api'

// ── Static demo data (replaced by API data when available) ───────────────────

const HARVEST_TREND = [
  { month: 'Jan', kg: 1200, batches: 8  },
  { month: 'Feb', kg: 980,  batches: 6  },
  { month: 'Mar', kg: 1450, batches: 10 },
  { month: 'Apr', kg: 1700, batches: 12 },
  { month: 'May', kg: 1300, batches: 9  },
  { month: 'Jun', kg: 1620, batches: 11 },
  { month: 'Jul', kg: 1850, batches: 14 },
]

const QUALITY_DATA = [
  { name: 'Grade A', value: 42, fill: '#22c55e' },
  { name: 'Grade B', value: 30, fill: '#3b82f6' },
  { name: 'Grade C', value: 18, fill: '#f59e0b' },
  { name: 'Grade D', value: 10, fill: '#ef4444' },
]

const WASTE_BY_TYPE = [
  { type: 'Rotten',      kg: 320 },
  { type: 'Damaged',     kg: 180 },
  { type: 'Overripe',    kg: 240 },
  { type: 'Unused Parts',kg: 90  },
  { type: 'Other',       kg: 45  },
]

const TRANSPORT_TREND = [
  { month: 'Jan', delivered: 7,  delayed: 1 },
  { month: 'Feb', delivered: 5,  delayed: 2 },
  { month: 'Mar', delivered: 9,  delayed: 1 },
  { month: 'Apr', delivered: 11, delayed: 0 },
  { month: 'May', delivered: 8,  delayed: 2 },
  { month: 'Jun', delivered: 10, delayed: 1 },
  { month: 'Jul', delivered: 13, delayed: 1 },
]

const KPI_ROWS = [
  { metric: 'Total Harvest Volume',     value: '10,100 kg',   change: '+12%',  positive: true  },
  { metric: 'Average Batch Size',       value: '148 kg',      change: '+5%',   positive: true  },
  { metric: 'Grade A Percentage',       value: '42%',         change: '+3%',   positive: true  },
  { metric: 'Waste Rate',               value: '8.7%',        change: '-1.2%', positive: true  },
  { metric: 'Transport On-Time Rate',   value: '91%',         change: '+4%',   positive: true  },
  { metric: 'Avg Delivery Days',        value: '2.3 days',    change: '-0.4',  positive: true  },
]

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

  useEffect(() => {
    apiClient.getAIMetrics()
      .then(setAiMetrics)
      .catch(() => null)
  }, [])

  const handleExport = async (type: string) => {
    try {
      const blob = await apiClient.downloadReport(type)
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `pinetrack-${type}-report.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Report generation not available yet.')
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
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
            <SectionHeader title="Quality Grade Distribution" sub="% of harvest batches" />
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
                <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2: Waste by type + Transport trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Waste by Type" sub="Total kg per waste category" />
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
            <SectionHeader title="Transport Performance" sub="Monthly delivered vs delayed" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={TRANSPORT_TREND} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="delivered" name="Delivered" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="delayed"   name="Delayed"   fill={CHART_COLORS.danger}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Metrics */}
        {aiMetrics && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <SectionHeader title="AI Engine Metrics" sub="Prediction engine performance" />
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
            <SectionHeader title="Key Performance Indicators" sub="Period comparison summary" />
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

