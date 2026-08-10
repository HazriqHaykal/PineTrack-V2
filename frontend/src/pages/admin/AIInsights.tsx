import { useState } from 'react'
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, Zap, BarChart3, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import AdminLayout from '../../components/layout/AdminLayout'

const HARVEST_PREDICTIONS = [
  { month: 'Dec', actual: 2100, predicted: 2050, confidence: 92 },
  { month: 'Jan', actual: 2350, predicted: 2300, confidence: 89 },
  { month: 'Feb', actual: 2200, predicted: 2280, confidence: 85 },
  { month: 'Mar', actual: 2600, predicted: 2550, confidence: 91 },
  { month: 'Apr', actual: 2450, predicted: 2480, confidence: 88 },
  { month: 'May', actual: null, predicted: 2700, confidence: 84 },
  { month: 'Jun', actual: null, predicted: 2850, confidence: 79 },
]

const MODEL_METRICS = [
  { metric: 'Accuracy',    value: 87 },
  { metric: 'Precision',   value: 83 },
  { metric: 'Recall',      value: 91 },
  { metric: 'F1 Score',    value: 87 },
  { metric: 'RMSE Score',  value: 78 },
  { metric: 'Coverage',    value: 94 },
]

const RECOMMENDATIONS = [
  {
    id: 1,
    type: 'harvest',
    priority: 'high',
    title: 'Optimal Harvest Window: Block C',
    description: 'Block C pineapples are approaching peak ripeness. Recommend harvesting within the next 3–5 days for maximum Grade A yield.',
    confidence: 91,
    impact: '+12% yield improvement',
    action: 'Schedule harvest team',
  },
  {
    id: 2,
    type: 'waste',
    priority: 'medium',
    title: 'Waste Reduction Opportunity',
    description: 'Current waste rate in Block B is 8.2%, above the 5% target. AI analysis suggests earlier harvest timing could reduce losses.',
    confidence: 78,
    impact: '-3.2% waste reduction',
    action: 'Review harvest schedule',
  },
  {
    id: 3,
    type: 'transport',
    priority: 'low',
    title: 'Transport Route Optimization',
    description: 'Consolidating Tuesday and Wednesday deliveries to Cold Storage could reduce transport costs by approximately 15%.',
    confidence: 72,
    impact: '15% cost reduction',
    action: 'Optimize delivery schedule',
  },
  {
    id: 4,
    type: 'harvest',
    priority: 'medium',
    title: 'Weather Impact Alert',
    description: 'Forecasted heavy rain in Week 3 may delay harvest operations. Pre-emptive harvest of Block D recommended.',
    confidence: 85,
    impact: 'Risk mitigation',
    action: 'Advance Block D harvest',
  },
]

const AI_LOGS = [
  { time: '09:42 AM', event: 'Harvest prediction model retrained',  status: 'success' },
  { time: '08:15 AM', event: 'Waste classification batch processed', status: 'success' },
  { time: 'Yesterday', event: 'New recommendation generated for Block C', status: 'success' },
  { time: 'Yesterday', event: 'Model drift detected — minor recalibration', status: 'warning' },
  { time: '2 days ago', event: 'Monthly accuracy report generated', status: 'success' },
]

const PRIORITY_STYLES = {
  high:   { badge: 'bg-red-100 text-red-700',    bar: 'bg-red-500'   },
  medium: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  low:    { badge: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500'  },
}

const TYPE_COLOR = {
  harvest:   'text-green-600 bg-green-50',
  waste:     'text-orange-600 bg-orange-50',
  transport: 'text-blue-600 bg-blue-50',
}

export default function AIInsights() {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 1200))
    setRefreshing(false)
  }

  return (
    <AdminLayout title="AI Insights" subtitle="Machine learning predictions & recommendations">

      {/* Model status bar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/30">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">AI Model: PineAI v2.1</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-green-500" />
              </span>
              <p className="text-green-400 text-xs font-medium">Active · Last trained 2 hours ago</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Model Accuracy',    value: '87%',  icon: <CheckCircle2 size={18} />, color: 'text-green-600 bg-green-50',  change: '+2.3%'  },
          { label: 'Predictions Made',  value: '1,284',icon: <Zap          size={18} />, color: 'text-purple-600 bg-purple-50',change: 'This month'},
          { label: 'Recommendations',   value: '4',    icon: <Brain        size={18} />, color: 'text-blue-600 bg-blue-50',    change: '2 high priority'},
          { label: 'Waste Reduction',   value: '18%',  icon: <TrendingUp   size={18} />, color: 'text-amber-600 bg-amber-50',  change: 'vs last quarter'},
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${k.color}`}>{k.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-green-600 font-semibold mt-1">{k.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Prediction chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Harvest Forecast</h3>
              <p className="text-xs text-gray-500">Actual vs AI-predicted harvest volume (kg)</p>
            </div>
            <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-1 rounded-full">
              84–92% confidence
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={HARVEST_PREDICTIONS} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} kg`]} />
              <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#16a34a" fill="url(#actualGrad)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#6366f1" fill="url(#predGrad)"   strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Model performance radar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-slate-600" />
            <h3 className="text-sm font-bold text-gray-900">Model Performance</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={MODEL_METRICS}>
              <PolarGrid stroke="#f0f0f0" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Radar name="Score" dataKey="value" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">Active Recommendations</h3>
          </div>
          <span className="text-xs text-gray-500">{RECOMMENDATIONS.length} recommendations</span>
        </div>
        <div className="divide-y divide-gray-50">
          {RECOMMENDATIONS.map(rec => {
            const p = PRIORITY_STYLES[rec.priority as keyof typeof PRIORITY_STYLES]
            return (
              <div key={rec.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[rec.type as keyof typeof TYPE_COLOR]}`}>
                        {rec.type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${p.badge}`}>
                        {rec.priority} priority
                      </span>
                      <span className="text-[10px] text-gray-500">{rec.confidence}% confidence</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{rec.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">{rec.impact}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="w-12 h-12 relative">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#16a34a" strokeWidth="3"
                          strokeDasharray={`${rec.confidence} ${100 - rec.confidence}`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                        {rec.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
                <button className="mt-3 px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                  {rec.action}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Activity log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Activity size={15} className="text-slate-600" />
          <h3 className="text-sm font-bold text-gray-900">AI Activity Log</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {AI_LOGS.map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              {log.status === 'success'
                ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                : <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              }
              <p className="text-sm text-gray-700 flex-1">{log.event}</p>
              <span className="text-xs text-gray-400 shrink-0">{log.time}</span>
            </div>
          ))}
        </div>
      </div>

    </AdminLayout>
  )
}
