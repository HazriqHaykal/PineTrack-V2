import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Sprout, Truck, Recycle, Brain, TrendingUp, Users,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, ArrowRight, UserCircle
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { authService } from '../../services/auth'
import { AnalyticsOverview, HarvestStats, TransportEfficiency, WasteStats } from '../../types'

const GRADE_FILL: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
  ungraded: '#94a3b8',
}

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100  text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-red-100   text-red-800',
}

interface KPICardProps {
  icon: React.ElementType
  label: string
  value: string | number
  sub: string
  trend?: string
  positive?: boolean
  color: string
  onClick?: () => void
}

function KPICard({ icon: Icon, label, value, sub, trend, positive = true, color, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${positive ? 'text-green-600' : 'text-red-500'}`}>
            <ArrowUpRight size={12} /> {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">{label}</p>
      </div>
      <p className="text-xs text-gray-500 border-t border-gray-50 pt-1.5">{sub}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user     = authService.getUser()

  const [hStats, setHStats]  = useState<HarvestStats | null>(null)
  const [tStats, setTStats]  = useState<TransportEfficiency | null>(null)
  const [wStats, setWStats]  = useState<WasteStats | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loaded, setLoaded]  = useState(false)
  const [error, setError]    = useState('')

  useEffect(() => {
    Promise.all([
      apiClient.getHarvestStats(),
      apiClient.getTransportEfficiency(),
      apiClient.getWasteStats(),
      apiClient.getAnalyticsOverview(6),
    ])
      .then(([h, t, w, o]) => { setHStats(h); setTStats(t); setWStats(w); setOverview(o) })
      .catch((err) => setError(apiErrorMessage(err, 'Failed to load dashboard data.')))
      .finally(() => setLoaded(true))
  }, [])

  const gradePie = (overview?.grade_distribution ?? []).map(g => ({
    name: g.grade === 'ungraded' ? 'Ungraded' : `Grade ${g.grade}`,
    value: g.count,
    fill: GRADE_FILL[g.grade] ?? GRADE_FILL.ungraded,
  }))
  const alerts = overview?.alerts ?? []

  const today = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Operations Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">{today}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <UserCircle size={14} /> {user?.full_name || user?.username}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* ── KPI Row ── */}
        {loaded && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KPICard
              icon={Sprout}     label="Total Harvests"  value={hStats?.total_harvests ?? 0}
              sub={`${hStats?.total_quantity_kg?.toLocaleString() ?? 0} kg total`}
              color="bg-green-500"  onClick={() => navigate('/harvest')} />
            <KPICard
              icon={Truck}      label="Transport Rate"  value={`${tStats?.delivery_rate_percent ?? 0}%`}
              sub={`${tStats?.delivered ?? 0} of ${tStats?.total_transports ?? 0} delivered`}
              color="bg-blue-500"   onClick={() => navigate('/transport')} />
            <KPICard
              icon={Recycle}    label="Waste Logged"    value={`${wStats?.total_waste_kg ?? 0} kg`}
              sub={`${wStats?.total_records ?? 0} records`}
              color="bg-orange-500" onClick={() => navigate('/waste')} />
            <KPICard
              icon={Brain}      label="Agent Confidence"   value={`${Math.round((overview?.ai.average_confidence ?? 0) * 100)}%`}
              sub={`${overview?.ai.predictions_this_month ?? 0} predictions this month`}
              color="bg-purple-500" onClick={() => navigate('/admin/ai-insights')} />
            <KPICard
              icon={Users}      label="Active Workers"  value={overview?.workers.active ?? 0}
              sub={`${overview?.workers.on_field_today ?? 0} with tasks today`}
              color="bg-teal-500"  onClick={() => navigate('/admin/users')} />
            <KPICard
              icon={TrendingUp} label="Avg Batch (kg)"  value={hStats?.average_quantity_kg?.toFixed(0) ?? 0}
              sub={`${hStats?.this_month ?? 0} batches this month`}
              color="bg-indigo-500" onClick={() => navigate('/analytics')} />
          </div>
        )}

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Harvest volume trend */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Harvest Volume</h3>
                <p className="text-xs text-gray-400">Monthly kg — last 6 months</p>
              </div>
              <button onClick={() => navigate('/analytics')}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                Full view <ArrowRight size={11} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={overview?.harvest_trend ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gKg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area  type="monotone" dataKey="kg"     name="Harvested (kg)"  stroke="#22c55e" strokeWidth={2} fill="url(#gKg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quality pie */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Quality Grade Split</h3>
              <p className="text-xs text-gray-400">Batches in the last 6 months</p>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={gradePie} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {gradePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} batches`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Worker performance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Worker Performance</h3>
                <p className="text-xs text-gray-400">Tasks assigned vs completed</p>
              </div>
              <button onClick={() => navigate('/admin/users')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Manage <ArrowRight size={11} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={overview?.worker_performance ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tasks"     name="Assigned"  fill="#cbd5e1" radius={[4,4,0,0]} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Alerts panel */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">System Alerts</h3>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                {alerts.filter(a => a.level === 'warning').length} warnings
              </span>
            </div>
            <div className="space-y-2.5">
              {alerts.map((a, i) => (
                <div key={i} onClick={() => a.link && navigate(a.link)}
                  className={`flex items-start gap-3 p-3 rounded-lg text-sm ${a.link ? 'cursor-pointer' : ''} ${
                  a.level === 'warning' ? 'bg-amber-50' :
                  a.level === 'success' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                  {a.level === 'warning' ? <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" /> :
                   a.level === 'success' ? <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5"  /> :
                                           <Clock        size={15} className="text-blue-500  shrink-0 mt-0.5"  />}
                  <div className="min-w-0">
                    <p className="text-gray-700 text-xs leading-snug">{a.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Harvests Table ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Recent Harvest Activity</h3>
              <p className="text-xs text-gray-400">Last 5 batches across all fields</p>
            </div>
            <button onClick={() => navigate('/harvest')}
              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium">
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Field', 'Date', 'Quantity', 'Grade', 'Worker'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(overview?.recent_harvests ?? []).map((r, i) => (
                  <tr key={r.id} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.field}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.date}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{r.kg} kg</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${GRADE_BADGE[r.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.grade === 'ungraded' ? 'Ungraded' : `Grade ${r.grade}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{r.worker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
