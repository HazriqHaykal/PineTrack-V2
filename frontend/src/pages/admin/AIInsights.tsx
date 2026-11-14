import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import AgentOverview from '../../components/agent/AgentOverview'
import AskAgent from '../../components/agent/AskAgent'
import AgentHistory from '../../components/agent/AgentHistory'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AIMetrics, AIRecommendations, AIStatus } from '../../types'

type Tab = 'overview' | 'ask' | 'history'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'ask', label: 'Ask Agent' },
  { key: 'history', label: 'Activity History' },
]

/** Engine configured on the server; each answer also records which engine actually produced it */
function ModeIndicator({ status }: { status: AIStatus | null }) {
  if (!status) return <span className="text-xs text-gray-500">Checking agent…</span>
  const gemini = status.gemini_configured
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
      gemini ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-gray-100 text-gray-700 ring-gray-200'
    }`}>
      <span className={`h-2 w-2 rounded-full ${gemini ? 'bg-green-600' : 'bg-gray-400'}`} aria-hidden />
      {gemini ? 'Gemini Active' : 'Built-in Rules'}
    </span>
  )
}

export default function AIInsights() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'overview'

  const [status, setStatus]   = useState<AIStatus | null>(null)
  const [recs, setRecs]       = useState<AIRecommendations | null>(null)
  const [metrics, setMetrics] = useState<AIMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]     = useState('')

  const loadMetrics = useCallback(() => apiClient.getAIMetrics().then(setMetrics).catch(() => setMetrics(null)), [])

  useEffect(() => {
    apiClient.getAIStatus().then(setStatus).catch(() => setStatus(null))
    loadMetrics()
    // Cached recommendations; the backend generates them on first use
    apiClient.getAIRecommendations()
      .then(setRecs)
      .catch((err) => setError(apiErrorMessage(err, 'Failed to load recommendations.')))
      .finally(() => setLoading(false))
  }, [loadMetrics])

  const regenerate = async () => {
    setRefreshing(true)
    setError('')
    try {
      setRecs(await apiClient.refreshAIRecommendations())
      loadMetrics()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to generate recommendations.'))
    } finally {
      setRefreshing(false)
    }
  }

  const selectTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PineTrack Agent</h1>
            <p className="text-sm text-gray-500 mt-0.5">Smart insights for your post-harvest operations.</p>
          </div>
          <ModeIndicator status={status} />
        </div>

        <div role="tablist" aria-label="PineTrack Agent" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" id={`agent-tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`agent-panel-${t.key}`}
              onClick={() => selectTab(t.key)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-green-700 text-green-800' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && tab === 'overview' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" /> {error}
          </div>
        )}

        <div role="tabpanel" id={`agent-panel-${tab}`} aria-labelledby={`agent-tab-${tab}`}>
          {tab === 'overview' && (
            <AgentOverview status={status} recs={recs} metrics={metrics} loading={loading} refreshing={refreshing} onRegenerate={regenerate} />
          )}
          {tab === 'ask' && <AskAgent />}
          {tab === 'history' && <AgentHistory status={status} metrics={metrics} />}
        </div>
      </div>
    </AdminLayout>
  )
}
