import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, AlertTriangle, CheckCircle2, RefreshCw, Zap, BarChart3, Activity, Gauge } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AILog, AIMetrics, AIRecommendation, AIRecommendations, AIStatus } from '../../types'

const PRIORITY_STYLES = {
  high:   { badge: 'bg-red-100 text-red-700'     },
  medium: { badge: 'bg-amber-100 text-amber-700' },
  low:    { badge: 'bg-blue-100 text-blue-700'   },
}

const TYPE_COLOR = {
  harvest:   'text-green-600 bg-green-50',
  waste:     'text-orange-600 bg-orange-50',
  transport: 'text-blue-600 bg-blue-50',
  schedule:  'text-purple-600 bg-purple-50',
}

// Where each recommendation's action button takes the admin
const TYPE_PATH = {
  harvest:   '/harvest',
  waste:     '/waste',
  transport: '/transport',
  schedule:  '/schedule',
}

const LOG_LABEL: Record<string, string> = {
  harvest_timing:       'Harvest timing prediction',
  waste_classification: 'Waste classification',
  recommendations:      'Farm recommendations generated',
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AIInsights() {
  const navigate = useNavigate()
  const [status, setStatus]   = useState<AIStatus | null>(null)
  const [recs, setRecs]       = useState<AIRecommendations | null>(null)
  const [metrics, setMetrics] = useState<AIMetrics | null>(null)
  const [logs, setLogs]       = useState<AILog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]     = useState('')

  const loadActivity = async () => {
    const [m, l] = await Promise.all([apiClient.getAIMetrics(), apiClient.getAILogs(0, 10)])
    setMetrics(m)
    setLogs(l.items)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [s, r] = await Promise.all([apiClient.getAIStatus(), apiClient.getAIRecommendations()])
        setStatus(s)
        setRecs(r)
        await loadActivity()
      } catch (err) {
        setError(apiErrorMessage(err, 'Failed to load PineTrack Agent.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      setRecs(await apiClient.refreshAIRecommendations())
      await loadActivity()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to generate recommendations.'))
    } finally {
      setRefreshing(false)
    }
  }

  const items = recs?.items ?? []
  const highPriority = items.filter(r => r.priority === 'high').length
  const usingGemini = status?.gemini_configured ?? false

  const typeChart = Object.entries(metrics?.by_prediction_type ?? {}).map(([type, count]) => ({
    type: LOG_LABEL[type]?.replace(' prediction', '').replace(' generated', '') ?? type,
    count,
  }))

  return (
    <AdminLayout title="PineTrack Agent" subtitle="Recommendations worked out from your farm data">

      {/* Engine status bar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${usingGemini ? 'bg-green-500' : 'bg-amber-500'}`}>
            <Brain size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              PineTrack Agent
            </p>
            <p className={`text-xs font-medium mt-0.5 ${usingGemini ? 'text-green-400' : 'text-amber-300'}`}>
              {!status
                ? 'Checking…'
                : usingGemini
                  ? `Online · ${status.model.replace('gemini:', '')}`
                  : 'Running on built-in rules. Add GEMINI_API_KEY to backend/.env to switch the agent to Gemini.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/ai')}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors shrink-0 ml-auto"
        >
          <Zap size={14} /> Ask the agent
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertTriangle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Predictions Made',  value: metrics?.total_predictions ?? 0, icon: <Zap size={18} />,           color: 'text-purple-600 bg-purple-50', note: 'All time' },
          { label: 'Avg Confidence',    value: `${Math.round((metrics?.average_confidence ?? 0) * 100)}%`, icon: <Gauge size={18} />, color: 'text-green-600 bg-green-50', note: 'Across all predictions' },
          { label: 'Recommendations',   value: items.length, icon: <Brain size={18} />,                             color: 'text-blue-600 bg-blue-50', note: `${highPriority} high priority` },
          { label: 'Mode',              value: usingGemini ? 'Agent' : 'Rules', icon: <CheckCircle2 size={18} />,  color: 'text-amber-600 bg-amber-50', note: recs ? `Last run ${formatWhen(recs.generated_at)}` : '—' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${k.color}`}>{k.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-1">{k.note}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">Active Recommendations</h3>
          </div>
          <span className="text-xs text-gray-500">
            {recs ? `${items.length} from ${recs.source === 'gemini' ? 'PineTrack Agent' : 'built-in rules'}` : ''}
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Analysing farm data…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No recommendations yet. Click Regenerate.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((rec: AIRecommendation) => (
              <div key={rec.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[rec.type] ?? TYPE_COLOR.harvest}`}>
                        {rec.type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${(PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.medium).badge}`}>
                        {rec.priority} priority
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{rec.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.description}</p>
                    {rec.impact && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">{rec.impact}</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <div className="w-12 h-12 relative" title="Confidence">
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
                <button
                  onClick={() => navigate(TYPE_PATH[rec.type] ?? '/dashboard')}
                  className="mt-3 px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                >
                  {rec.action}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage by type */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-slate-600" />
            <h3 className="text-sm font-bold text-gray-900">Predictions by Type</h3>
          </div>
          {typeChart.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No predictions yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeChart} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Predictions" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity log */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Activity size={15} className="text-slate-600" />
            <h3 className="text-sm font-bold text-gray-900">Agent Activity Log</h3>
          </div>
          {logs.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No agent activity yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {LOG_LABEL[log.prediction_type] ?? log.prediction_type}
                      <span className="text-gray-400"> — {log.prediction_result.replace('_', ' ')}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">{log.model_version.startsWith('gemini') ? 'PineTrack Agent' : 'Built-in rules'}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatWhen(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </AdminLayout>
  )
}
