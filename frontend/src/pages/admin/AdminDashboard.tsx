import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Sprout, Truck, Recycle, Brain, TrendingUp, Users,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, ArrowRight, Bell
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient } from '../../services/api'
import { authService } from '../../services/auth'
import { HarvestStats, TransportEfficiency, WasteStats } from '../../types'

// ── demo data ──────────────────────────────────────────────────────
const HARVEST_TREND = [
  { month: 'Jan', kg: 1200, target: 1100 },
  { month: 'Feb', kg: 980,  target: 1100 },
  { month: 'Mar', kg: 1450, target: 1200 },
  { month: 'Apr', kg: 1700, target: 1300 },
  { month: 'May', kg: 1300, target: 1300 },
  { month: 'Jun', kg: 1620, target: 1400 },
]

const QUALITY_PIE = [
  { name: 'Grade A', value: 42, fill: '#22c55e' },
  { name: 'Grade B', value: 30, fill: '#3b82f6' },
  { name: 'Grade C', value: 18, fill: '#f59e0b' },
  { name: 'Grade D', value: 10, fill: '#ef4444' },
]

const WORKER_PERF = [
  { name: 'Ahmad',  tasks: 18, completed: 16 },
  { name: 'Ali',    tasks: 14, completed: 14 },
  { name: 'Faizal', tasks: 12, completed: 10 },
  { name: 'Kamal',  tasks: 9,  completed: 8  },
]

const ALERTS = [
  { level: 'warning', msg: 'Block C-2 ripeness index dropped below 4.0',   time: '2h ago'  },
  { level: 'info',    msg: 'Transport JHF-5678 delivered to Johor Bahru',  time: '3h ago'  },
  { level: 'warning', msg: 'Waste rate in Block D exceeded 12% threshold', time: '5h ago'  },
  { level: 'success', msg: 'AI model v2.0 achieved 91% harvest accuracy',  time: '1d ago'  },
]

const RECENT_HARVESTS = [
  { id: 1, field: 'Block A-1', date: '2026-05-20', kg: 185, grade: 'A', worker: 'Ahmad' },
  { id: 2, field: 'Block B-3', date: '2026-05-18', kg: 142, grade: 'B', worker: 'Ali'   },
  { id: 3, field: 'Block C-2', date: '2026-05-16', kg: 98,  grade: 'C', worker: 'Ahmad' },
  { id: 4, field: 'Block A-2', date: '2026-05-14', kg: 210, grade: 'A', worker: 'Faizal'},
  { id: 5, field: 'Block D-1', date: '2026-05-12', kg: 65,  grade: 'D', worker: 'Kamal' },
]

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
  const [loaded, setLoaded]  = useState(false)

  useEffect(() => {
    Promise.all([
      apiClient.getHarvestStats(),
      apiClient.getTransportEfficiency(),
      apiClient.getWasteStats(),
    ])
      .then(([h, t, w]) => { setHStats(h); setTStats(t); setWStats(w) })
      .catch(() => {
        setHStats({ total_harvests: 68, total_quantity_kg: 9840, average_quantity_kg: 144.7, by_grade: { A: 28, B: 22, C: 12, D: 6 }, this_month: 14 })
        setTStats({ total_transports: 41, delivered: 37, in_transit: 3, pending: 1, delivery_rate_percent: 90 })
        setWStats({ total_records: 23, total_waste_kg: 875, by_type: {}, by_classification: {} })
      })
      .finally(() => setLoaded(true))
  }, [])

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
          <div className="flex items-center gap-2">
            <button className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Bell size={18} className="text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="h-8 w-px bg-gray-200" />
            <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2">
              👤 {user?.full_name || user?.username}
            </span>
          </div>
        </div>

        {/* ── KPI Row ── */}
        {loaded && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KPICard
              icon={Sprout}     label="Total Harvests"  value={hStats?.total_harvests ?? 0}
              sub={`${hStats?.total_quantity_kg?.toLocaleString() ?? 0} kg total`}
              trend="+8%"  color="bg-green-500"  onClick={() => navigate('/harvest')} />
            <KPICard
              icon={Truck}      label="Transport Rate"  value={`${tStats?.delivery_rate_percent ?? 0}%`}
              sub={`${tStats?.delivered ?? 0} of ${tStats?.total_transports ?? 0} delivered`}
              trend="+4%"  color="bg-blue-500"   onClick={() => navigate('/transport')} />
            <KPICard
              icon={Recycle}    label="Waste Logged"    value={`${wStats?.total_waste_kg ?? 0} kg`}
              sub={`${wStats?.total_records ?? 0} records`}
              trend="-3%" positive={false} color="bg-orange-500" onClick={() => navigate('/waste')} />
            <KPICard
              icon={Brain}      label="AI Accuracy"     value="87%"
              sub="42 predictions this month"
              trend="+2%"  color="bg-purple-500" onClick={() => navigate('/admin/ai-insights')} />
            <KPICard
              icon={Users}      label="Active Workers"  value={12}
              sub="4 on field today"
              color="bg-teal-500"  onClick={() => navigate('/admin/users')} />
            <KPICard
              icon={TrendingUp} label="Avg Batch (kg)"  value={hStats?.average_quantity_kg?.toFixed(0) ?? 0}
              sub="Target: 150 kg"
              trend="-5%" positive={false} color="bg-indigo-500" onClick={() => navigate('/analytics')} />
          </div>
        )}

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Harvest volume trend */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Harvest Volume vs Target</h3>
                <p className="text-xs text-gray-400">Monthly kg — last 6 months</p>
              </div>
              <button onClick={() => navigate('/analytics')}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                Full view <ArrowRight size={11} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={HARVEST_TREND} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                <Area  type="monotone" dataKey="kg"     name="Actual (kg)"  stroke="#22c55e" strokeWidth={2} fill="url(#gKg)" />
                <Area  type="monotone" dataKey="target" name="Target (kg)"  stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quality pie */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Quality Grade Split</h3>
              <p className="text-xs text-gray-400">Distribution of all batches</p>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={QUALITY_PIE} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {QUALITY_PIE.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
              <BarChart data={WORKER_PERF} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
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
                {ALERTS.filter(a => a.level === 'warning').length} warnings
              </span>
            </div>
            <div className="space-y-2.5">
              {ALERTS.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                  a.level === 'warning' ? 'bg-amber-50' :
                  a.level === 'success' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                  {a.level === 'warning' ? <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" /> :
                   a.level === 'success' ? <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5"  /> :
                                           <Clock        size={15} className="text-blue-500  shrink-0 mt-0.5"  />}
                  <div className="min-w-0">
                    <p className="text-gray-700 text-xs leading-snug">{a.msg}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">{a.time}</p>
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
                {RECENT_HARVESTS.map((r, i) => (
                  <tr key={r.id} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.field}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.date}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{r.kg} kg</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${GRADE_BADGE[r.grade]}`}>
                        Grade {r.grade}
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
