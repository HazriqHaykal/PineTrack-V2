import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, History } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import AgentOverview from '../../components/agent/AgentOverview'
import AskAgent from '../../components/agent/AskAgent'
import AgentHistory from '../../components/agent/AgentHistory'
import { ModuleScopeSelect, useModuleScope } from '../../components/ui/ModuleScope'
import { apiClient, apiErrorMessage } from '../../services/api'
import { AIMetrics, AIRecommendations, AIStatus, AnalysisScope } from '../../types'

import { tr } from '../../i18n'

export default function AIInsights() {
  const [params, setParams] = useSearchParams()
  // Activity History is a secondary view; old ?tab=history links still open it
  const showHistory = params.get('view') === 'history' || params.get('tab') === 'history'
  // The backend builds the agent's input from this scope and caches each scope separately
  const [scope, setScope] = useModuleScope()

  const [status, setStatus]   = useState<AIStatus | null>(null)
  const [recsByScope, setRecsByScope] = useState<Partial<Record<AnalysisScope, AIRecommendations>>>({})
  const [metrics, setMetrics] = useState<AIMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]     = useState('')
  const latestScope = useRef(scope)

  const loadMetrics = useCallback(() => apiClient.getAIMetrics().then(setMetrics).catch(() => setMetrics(null)), [])

  useEffect(() => {
    apiClient.getAIStatus().then(setStatus).catch(() => setStatus(null))
    loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    latestScope.current = scope
    setError('')
    setLoading(true)
    // Cached set for this scope; the backend generates it on first use
    apiClient.getAIRecommendations(scope)
      .then((r) => {
        setRecsByScope((prev) => ({ ...prev, [scope]: r }))
        loadMetrics()
      })
      .catch((err) => { if (latestScope.current === scope) setError(apiErrorMessage(err, tr("Failed to load recommendations."))) })
      .finally(() => { if (latestScope.current === scope) setLoading(false) })
  }, [scope, loadMetrics])

  const regenerate = async () => {
    const forScope = scope
    setRefreshing(true)
    setError('')
    try {
      const r = await apiClient.refreshAIRecommendations(forScope)
      setRecsByScope((prev) => ({ ...prev, [forScope]: r }))
      loadMetrics()
    } catch (err) {
      setError(apiErrorMessage(err, tr("Failed to generate recommendations.")))
    } finally {
      setRefreshing(false)
    }
  }

  const setView = (history: boolean) => {
    const next = new URLSearchParams(params)
    next.delete('tab')
    if (history) next.set('view', 'history')
    else next.delete('view')
    setParams(next)
  }

  const recs = recsByScope[scope] ?? null

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-[1100px]">
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{showHistory ? tr("Activity History") : tr("PineTrack Agent")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {showHistory ? tr("Past agent answers and how often each tool is used.") : tr("Advice from your Sulur Inventory and Post-Harvest records.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showHistory ? (
              <button onClick={() => setView(false)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50">
                <ArrowLeft size={15} strokeWidth={1.75} /> {tr("Back to Agent")}
              </button>
            ) : (
              <button onClick={() => setView(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50">
                <History size={15} strokeWidth={1.75} /> {tr("Activity History")}
              </button>
            )}
          </div>
        </header>

        {showHistory ? (
          <AgentHistory status={status} metrics={metrics} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{tr("Module")}</span>
              <ModuleScopeSelect value={scope} onChange={setScope} disabled={refreshing} />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" /> {error}
              </div>
            )}

            <AgentOverview scope={scope} status={status} recs={recs}
              loading={loading && !recs} refreshing={refreshing} onRegenerate={regenerate} />

            <AskAgent scope={scope} />
          </>
        )}
      </div>
    </AdminLayout>
  )
}
