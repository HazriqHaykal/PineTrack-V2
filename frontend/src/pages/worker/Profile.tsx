import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCircle, LogOut, Award, Sprout, Truck, Recycle, Calendar, ChevronRight, Shield, Edit3, CheckCircle2 } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { authService } from '../../services/auth'

interface Stat { label: string; value: string; icon: React.ReactNode; color: string }

const ACHIEVEMENTS = [
  { icon: '🏆', label: 'Top Harvester',    desc: 'Logged 500+ kg this month',   earned: true  },
  { icon: '⚡', label: 'Speed Record',      desc: 'Completed 10 tasks in a day', earned: true  },
  { icon: '🌱', label: 'Zero Waste Hero',   desc: 'Lowest waste rate this week', earned: false },
  { icon: '📦', label: 'Perfect Delivery',  desc: '100% on-time deliveries',     earned: false },
]

export default function Profile() {
  const navigate  = useNavigate()
  const user      = authService.getUser()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.full_name || user?.username || 'Worker')

  const stats: Stat[] = [
    { label: 'Harvests',   value: '42',    icon: <Sprout  size={16} />, color: 'text-green-600 bg-green-50'  },
    { label: 'Transports', value: '28',    icon: <Truck   size={16} />, color: 'text-blue-600 bg-blue-50'    },
    { label: 'Waste Logs', value: '15',    icon: <Recycle size={16} />, color: 'text-orange-500 bg-orange-50'},
    { label: 'Tasks Done', value: '89',    icon: <CheckCircle2 size={16} />, color: 'text-purple-600 bg-purple-50'},
  ]

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
                  onBlur={() => setEditing(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                  className="bg-white/20 text-white placeholder-white/50 rounded-lg px-3 py-1 text-base font-bold w-full outline-none border border-white/30"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold leading-tight truncate">{name}</h2>
                  <button onClick={() => setEditing(true)} className="text-white/70 hover:text-white">
                    <Edit3 size={14} />
                  </button>
                </div>
              )}
              <p className="text-green-100 text-xs mt-0.5">@{user?.username}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <Shield size={12} className="text-green-200" />
                <span className="text-[11px] text-green-100 uppercase font-semibold tracking-wide">Field Worker</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-green-200 uppercase tracking-wide">Employee ID</p>
              <p className="text-sm font-mono font-semibold mt-0.5">{`WRK-${String(user?.id || '001').padStart(3, '0')}`}</p>
            </div>
            <div>
              <p className="text-[10px] text-green-200 uppercase tracking-wide">Member Since</p>
              <p className="text-sm font-semibold mt-0.5">Jan 2024</p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Statistics</h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
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
            {ACHIEVEMENTS.map(a => (
              <div
                key={a.label}
                className={`rounded-2xl border p-3.5 ${
                  a.earned ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 opacity-50'
                }`}
              >
                <div className="text-2xl mb-1.5">{a.icon}</div>
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
            { icon: <Sprout size={16} className="text-green-600" />,    label: 'Harvest Entries', path: '/harvest-entry' },
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
