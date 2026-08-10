import React, { useState } from 'react'
import { Brain, Leaf, Recycle, Activity, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient } from '../../services/api'
import { AIHarvestPrediction, AIWastePrediction } from '../../types'

type ActiveTab = 'harvest' | 'waste'

const CONFIDENCE_COLOR = (score: number) => {
  if (score >= 0.75) return 'text-green-600'
  if (score >= 0.5)  return 'text-amber-600'
  return 'text-red-600'
}

const CONFIDENCE_BG = (score: number) => {
  if (score >= 0.75) return 'bg-green-100 border-green-200'
  if (score >= 0.5)  return 'bg-amber-100 border-amber-200'
  return 'bg-red-100 border-red-200'
}

const RECOMMENDATION_ICON = (rec: string) => {
  if (rec.includes('Now'))         return <CheckCircle size={20} className="text-green-600" />
  if (rec.includes('2-3'))         return <AlertCircle size={20} className="text-amber-600" />
  return <HelpCircle size={20} className="text-blue-600" />
}

export default function AIPage() {
  const [tab, setTab]   = useState<ActiveTab>('harvest')

  // Harvest timing form
  const [hForm, setHForm] = useState({ harvest_id: 1, ripeness_level: 6, days_since_last_harvest: 14, field_condition_score: 7 })
  const [hResult, setHResult] = useState<AIHarvestPrediction | null>(null)
  const [hLoading, setHLoad]  = useState(false)
  const [hError, setHError]   = useState('')

  // Waste classification form
  const [wForm, setWForm] = useState({ quality_grade: 'B', damage_level: 4, age_days: 5 })
  const [wResult, setWResult] = useState<AIWastePrediction | null>(null)
  const [wLoading, setWLoad]  = useState(false)
  const [wError, setWError]   = useState('')

  const predictHarvest = async (e: React.FormEvent) => {
    e.preventDefault()
    setHLoad(true)
    setHError('')
    setHResult(null)
    try {
      const res = await apiClient.predictHarvestTiming(hForm)
      setHResult(res)
    } catch (err: any) {
      setHError(err.response?.data?.detail || 'Prediction failed. Check your API connection.')
    } finally {
      setHLoad(false)
    }
  }

  const predictWaste = async (e: React.FormEvent) => {
    e.preventDefault()
    setWLoad(true)
    setWError('')
    setWResult(null)
    try {
      const res = await apiClient.predictWasteClassification(wForm)
      setWResult(res)
    } catch (err: any) {
      setWError(err.response?.data?.detail || 'Classification failed. Check your API connection.')
    } finally {
      setWLoad(false)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI Recommendation Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Machine learning models for harvest timing and waste classification
          </p>
        </div>

        {/* Model info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Brain,   title: 'Decision Tree',   desc: 'Primary model for harvest timing predictions',    badge: 'v2.0 Active', color: 'text-purple-600 bg-purple-50' },
            { icon: Activity,title: 'Random Forest',   desc: 'Ensemble model for quality & waste classification', badge: 'v2.0 Active', color: 'text-blue-600 bg-blue-50'   },
            { icon: Leaf,    title: 'Rule Engine',     desc: 'Expert system fallback for edge cases',             badge: 'Fallback',    color: 'text-green-600 bg-green-50' },
          ].map((m) => {
            const Icon = m.icon
            return (
              <div key={m.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
                <div className={`p-2.5 rounded-xl ${m.color} shrink-0 h-fit`}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{m.title}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{m.badge}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{m.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {([
            { key: 'harvest', label: 'Harvest Timing', icon: Leaf    },
            { key: 'waste',   label: 'Waste Classification', icon: Recycle },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── HARVEST TIMING ────────────────────────────────────────────── */}
          {tab === 'harvest' && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Harvest Timing Prediction</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Input field parameters to determine the optimal harvest window.
                </p>

                {hError && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {hError}
                  </div>
                )}

                <form onSubmit={predictHarvest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Harvest ID (existing batch)
                    </label>
                    <input type="number" value={hForm.harvest_id}
                      onChange={(e) => setHForm({...hForm, harvest_id: parseInt(e.target.value)})}
                      min="1" required
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Ripeness Level: <span className="text-purple-600">{hForm.ripeness_level}/10</span>
                    </label>
                    <input type="range" min="0" max="10" step="0.5" value={hForm.ripeness_level}
                      onChange={(e) => setHForm({...hForm, ripeness_level: parseFloat(e.target.value)})}
                      className="w-full accent-purple-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Unripe (0)</span><span>Ripe (10)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Days Since Last Harvest: <span className="text-purple-600">{hForm.days_since_last_harvest}</span>
                    </label>
                    <input type="range" min="0" max="90" step="1" value={hForm.days_since_last_harvest}
                      onChange={(e) => setHForm({...hForm, days_since_last_harvest: parseInt(e.target.value)})}
                      className="w-full accent-purple-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0 days</span><span>90 days</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Field Condition Score: <span className="text-purple-600">{hForm.field_condition_score}/10</span>
                    </label>
                    <input type="range" min="0" max="10" step="0.5" value={hForm.field_condition_score}
                      onChange={(e) => setHForm({...hForm, field_condition_score: parseFloat(e.target.value)})}
                      className="w-full accent-purple-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Poor (0)</span><span>Excellent (10)</span>
                    </div>
                  </div>

                  <button type="submit" disabled={hLoading}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mt-2">
                    <Brain size={16} />
                    {hLoading ? 'Analyzing…' : 'Run Harvest Prediction'}
                  </button>
                </form>
              </div>

              {/* Result */}
              <div>
                {hResult ? (
                  <div className={`rounded-xl border p-6 ${CONFIDENCE_BG(hResult.confidence_score)}`}>
                    <div className="flex items-center gap-3 mb-4">
                      {RECOMMENDATION_ICON(hResult.recommendation)}
                      <div>
                        <p className="font-bold text-gray-900 text-xl">{hResult.recommendation}</p>
                        <p className={`text-sm font-semibold ${CONFIDENCE_COLOR(hResult.confidence_score)}`}>
                          {Math.round(hResult.confidence_score * 100)}% confidence
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Quality Prediction</p>
                        <p className="font-bold text-gray-900">{hResult.quality_prediction}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Transport Priority</p>
                        <p className="font-bold text-gray-900">{hResult.transport_priority}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reasoning Breakdown</p>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Ripeness Level',    value: `${hResult.reasoning.ripeness_level}/10`,    max: 10 },
                          { label: 'Days Since Harvest', value: `${hResult.reasoning.days_since_harvest} days`, max: 90 },
                          { label: 'Field Condition',   value: `${hResult.reasoning.field_condition}/10`,   max: 10 },
                        ].map((row) => (
                          <div key={row.label}>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{row.label}</span>
                              <span className="font-semibold">{row.value}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{
                                width: `${(parseFloat(String(row.value)) / (typeof row.max === 'number' ? row.max : 90)) * 100}%`
                              }} />
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                          <span className="text-gray-500">Total Score</span>
                          <span className="font-bold text-purple-700">{hResult.reasoning.total_score}/100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                    <Brain size={48} className="opacity-20 mb-3" />
                    <p className="font-medium">Run a prediction to see results</p>
                    <p className="text-sm mt-1">Fill in the parameters and click Analyze</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── WASTE CLASSIFICATION ──────────────────────────────────────── */}
          {tab === 'waste' && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Waste Classification</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Classify waste type and recommended disposal method.
                </p>

                {wError && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {wError}
                  </div>
                )}

                <form onSubmit={predictWaste} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Quality Grade</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['A', 'B', 'C', 'D'].map((g) => (
                        <button key={g} type="button"
                          onClick={() => setWForm({...wForm, quality_grade: g})}
                          className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                            wForm.quality_grade === g
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Damage Level: <span className="text-orange-600">{wForm.damage_level}/10</span>
                    </label>
                    <input type="range" min="0" max="10" step="0.5" value={wForm.damage_level}
                      onChange={(e) => setWForm({...wForm, damage_level: parseFloat(e.target.value)})}
                      className="w-full accent-orange-500" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>None (0)</span><span>Severe (10)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Age (days): <span className="text-orange-600">{wForm.age_days}</span>
                    </label>
                    <input type="range" min="0" max="30" step="1" value={wForm.age_days}
                      onChange={(e) => setWForm({...wForm, age_days: parseInt(e.target.value)})}
                      className="w-full accent-orange-500" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Fresh (0)</span><span>Old (30)</span>
                    </div>
                  </div>

                  <button type="submit" disabled={wLoading}
                    className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mt-2">
                    <Recycle size={16} />
                    {wLoading ? 'Classifying…' : 'Classify Waste'}
                  </button>
                </form>
              </div>

              {/* Waste Result */}
              <div>
                {wResult ? (
                  <div className={`rounded-xl border p-6 ${CONFIDENCE_BG(wResult.confidence_score)}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Recycle size={24} className="text-orange-600" />
                      <div>
                        <p className="font-bold text-gray-900 text-xl capitalize">
                          {wResult.waste_type.replace('_', ' ')}
                        </p>
                        <p className={`text-sm font-semibold ${CONFIDENCE_COLOR(wResult.confidence_score)}`}>
                          {Math.round(wResult.confidence_score * 100)}% confidence
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Disposal Method</p>
                        <p className="font-bold text-gray-900 capitalize">{wResult.disposal_method}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Quality Grade</p>
                        <p className="font-bold text-gray-900">Grade {wResult.quality_grade}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Input Summary</p>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Quality Grade', value: `Grade ${wResult.quality_grade}` },
                          { label: 'Damage Level',  value: `${wResult.damage_level}/10`     },
                          { label: 'Age',           value: `${wResult.age_days} days`        },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="font-semibold text-gray-900">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendation tips */}
                    <div className="mt-4 p-3 bg-white rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggested Action</p>
                      <p className="text-sm text-gray-700">
                        {wResult.disposal_method === 'compost'
                          ? 'Send to composting facility. This material can be converted to organic fertilizer for fields.'
                          : wResult.disposal_method === 'donate'
                          ? 'Consider donating to local food banks or secondary processors before disposal.'
                          : 'Dispose of this waste following local environmental guidelines.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                    <Recycle size={48} className="opacity-20 mb-3" />
                    <p className="font-medium">Waste classification result</p>
                    <p className="text-sm mt-1">Select parameters and click Classify</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

