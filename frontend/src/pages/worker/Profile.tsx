import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCircle, LogOut, Award, Sprout, Truck, Recycle, Calendar, ChevronRight, Shield, Edit3,
  CheckCircle2, Trophy, Zap, Leaf, PackageCheck,
} from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { authService } from '../../services/auth'
import { apiClient, apiErrorMessage } from '../../services/api'
import { UserStats } from '../../types'

interface Stat { label: string; value: string | number; icon: React.ReactNode; color: string }

export default function Profile() {
  const navigate  = useNavigate()
  const user      = authService.getUser()
  const [editing, setEditing] = useState(false)
  const [name, setName]   = useState(user?.full_name || user?.username || 'Worker')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.getMyStats()
      .then(setStats)
      .catch(err => setError(apiErrorMessage(err, 'Could not load your statistics.')))
  }, [])

  const saveName = async () => {
    setEditing(false)
    const trimmed = name.trim()
    const previous = user?.full_name || user?.username || 'Worker'
    if (!trimmed || trimmed === previous) {
      setName(previous)
      return
    }
    try {
      const updated = await apiClient.updateMe({ full_name: trimmed })
      authService.setUser(updated)
      setName(updated.full_name)
      setError('')
    } catch (err) {
      setName(previous)
      setError(apiErrorMessage(err, 'Could not save your name.'))
    }
  }

  const statCards: Stat[] = [
    { label: 'Harvests',   value: stats?.harvest_count ?? '—',   icon: <Sprout  size={16} />, color: 'text-green-600 bg-green-50'  },
    { label: 'Deliveries', value: stats?.transport_count ?? '—', icon: <Truck   size={16} />, color: 'text-blue-600 bg-blue-50'    },
    { label: 'Waste Logs', value: stats?.waste_count ?? '—',     icon: <Recycle size={16} />, color: 'text-orange-500 bg-orange-50'},
    { label: 'Tasks Done', value: stats?.tasks_completed ?? '—', icon: <CheckCircle2 size={16} />, color: 'text-purple-600 bg-purple-50'},
  ]

  // Earned from the worker's real activity
  const achievements = [
    {
      icon: <Trophy size={22} />, label: 'Top Harvester',
      desc: `500+ kg harvested this month (${stats?.harvest_kg_this_month ?? 0} kg so far)`,
      earned: (stats?.harvest_kg_this_month ?? 0) >= 500,
    },
    {
      icon: <Zap size={22} />, label: 'Task Finisher',
      desc: `10+ tasks completed (${stats?.tasks_completed ?? 0} so far)`,
      earned: (stats?.tasks_completed ?? 0) >= 10,
    },
    {
      icon: <Leaf size={22} />, label: 'Zero Waste Hero',
      desc: 'Harvested this month with no waste logged',
      earned: (stats?.harvest_kg_this_month ?? 0) > 0 && (stats?.waste_kg_this_month ?? 0) === 0,
    },
    {
      icon: <PackageCheck size={22} />, label: 'Perfect Delivery',
      desc: 'Every completed delivery on time',
      earned: (stats?.deliveries_completed ?? 0) > 0 && stats?.deliveries_on_time === stats?.deliveries_completed,
    },
  ]

  const memberSince = stats?.member_since
    ? new Date(stats.member_since).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
    : '—'

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Profile card */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-green-200">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <UserCircle size={36} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                  className="bg-white/20 text-white placeholder-white/50 rounded-lg px-3 py-1 text-base font-bold w-full outline-none border border-white/30"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold leading-tight truncate">{name}</h2>
                  <button onClick={() => setEditing(true)} className="text-white/70 hover:text-white" title="Edit name">
                    <Edit3 size={14} />
                  </button>
                </div>
              )}
              <p className="text-green-100 text-xs mt-0.5">@{user?.username}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <Shield size={12} className="text-green-200" />
                <span className="text-[11px] text-green-100 uppercase font-semibold tracking-wide">
                  {user?.role === 'admin' ? 'Administrator' : 'Field Worker'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-green-200 uppercase tracking-wide">Employee ID</p>
              <p className="text-sm font-mono font-semibold mt-0.5">{`WRK-${String(user?.id ?? 0).padStart(3, '0')}`}</p>
            </div>
            <div>
              <p className="text-[10px] text-green-200 uppercase tracking-wide">Member Since</p>
              <p className="text-sm font-semibold mt-0.5">{memberSince}</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">{error}</p>
        )}

        {/* Stats grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Statistics</h2>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award size={14} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Achievements</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div
                key={a.label}
                className={`rounded-2xl border p-3.5 ${
                  a.earned ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 opacity-60'
                }`}
              >
                <div className={`mb-1.5 ${a.earned ? 'text-amber-500' : 'text-gray-400'}`}>{a.icon}</div>
                <p className={`text-xs font-bold ${a.earned ? 'text-amber-800' : 'text-gray-500'}`}>{a.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            { icon: <Calendar size={16} className="text-purple-600" />, label: 'My Schedule', path: '/my-schedule' },
            { icon: <Sprout size={16} className="text-green-600" />,    label: 'My Harvest & Waste Records', path: '/my-records' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">{link.icon}</div>
              <span className="flex-1 text-sm font-medium text-gray-700 text-left">{link.label}</span>
              <ChevronRight size={15} className="text-gray-400" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 text-red-600 rounded-2xl font-semibold text-sm hover:bg-red-100 transition-colors border border-red-100"
        >
          <LogOut size={16} />
          Sign Out
        </button>

      </div>
    </WorkerLayout>
  )
}
