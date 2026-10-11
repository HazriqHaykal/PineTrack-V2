import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, AlertCircle, Sprout, Truck, Recycle, ChevronRight, Sun, ClipboardCheck, Wrench } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { authService } from '../../services/auth'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Schedule } from '../../types'

const PRIORITY_STYLES = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    label: 'High'   },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', label: 'Medium' },
  low:    { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',   label: 'Low'    },
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:     <Clock size={15} className="text-gray-400" />,
  in_progress: <AlertCircle size={15} className="text-amber-500" />,
  completed:   <CheckCircle2 size={15} className="text-green-500" />,
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  harvest:     <Sprout size={16} className="text-green-600" />,
  transport:   <Truck size={16} className="text-blue-600" />,
  inspection:  <ClipboardCheck size={16} className="text-purple-600" />,
  maintenance: <Wrench size={16} className="text-slate-600" />,
  other:       <CheckCircle2 size={16} className="text-purple-600" />,
}

// Page where the work for each task type is recorded
const TYPE_PATH: Record<string, string> = {
  harvest:   '/harvest-entry',
  transport: '/transport-update',
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const user = authService.getUser()
  const [tasks, setTasks] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [greeting, setGreeting] = useState('Good morning')

  const load = async () => {
    try {
      const data = await apiClient.getMySchedule()
      const todayStr = localDate()
      // Today's tasks, plus anything older that is still open
      setTasks(data.schedules.filter(t =>
        t.status !== 'cancelled' &&
        (t.assigned_date === todayStr || (t.assigned_date < todayStr && t.status !== 'completed'))
      ))
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your tasks.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
    load()
  }, [])

  const pending    = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const completed  = tasks.filter(t => t.status === 'completed').length

  const setStatus = async (task: Schedule, status: Schedule['status']) => {
    try {
      await apiClient.updateScheduleStatus(task.id, status)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the task.'))
    }
  }

  const startTask = async (task: Schedule) => {
    if (task.status === 'pending') await setStatus(task, 'in_progress')
    const path = TYPE_PATH[task.task_type]
    if (path) navigate(path)
  }

  const today = new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayStr = localDate()

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Greeting header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-5 text-white shadow-lg shadow-green-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sun size={18} className="text-yellow-200" />
                <span className="text-green-100 text-sm">{greeting}</span>
              </div>
              <h1 className="text-xl font-bold leading-tight">
                {user?.full_name || user?.username || 'Worker'}
              </h1>
              <p className="text-green-100 text-xs mt-1">{today}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{tasks.length}</p>
              <p className="text-green-100 text-xs">tasks today</p>
            </div>
          </div>

          {/* Mini progress */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1 bg-white/20 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{pending}</p>
              <p className="text-[10px] text-green-100 uppercase tracking-wide">Pending</p>
            </div>
            <div className="flex-1 bg-white/20 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{inProgress}</p>
              <p className="text-[10px] text-green-100 uppercase tracking-wide">Active</p>
            </div>
            <div className="flex-1 bg-white/20 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{completed}</p>
              <p className="text-[10px] text-green-100 uppercase tracking-wide">Done</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/harvest-entry')}
              className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
                <Sprout size={22} className="text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center leading-tight">New Harvest</span>
            </button>
            <button
              onClick={() => navigate('/transport-update')}
              className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                <Truck size={22} className="text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center leading-tight">Transport</span>
            </button>
            <button
              onClick={() => navigate('/waste-submit')}
              className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-200 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
                <Recycle size={22} className="text-orange-500" />
              </div>
              <span className="text-xs font-semibold text-gray-700 text-center leading-tight">Log Waste</span>
            </button>
          </div>
        </div>

        {/* Task list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Today's Tasks</h2>
            <button onClick={() => navigate('/my-schedule')} className="text-xs text-green-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </button>
          </div>

          {error && (
            <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs mb-3">{error}</p>
          )}

          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <CheckCircle2 size={28} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm font-semibold text-gray-700">No tasks assigned for today</p>
              <p className="text-xs text-gray-400 mt-1">New tasks from your supervisor will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const p = PRIORITY_STYLES[task.priority ?? 'medium'] ?? PRIORITY_STYLES.medium
                const overdue = task.assigned_date < todayStr && task.status !== 'completed'
                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity ${
                      task.status === 'completed' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className={`h-1 ${p.bar}`} />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                          {TYPE_ICON[task.task_type] ?? TYPE_ICON.other}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm capitalize ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {task.task_type}
                            </p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
                            {overdue && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>
                            )}
                          </div>
                          {task.details && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{task.details}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1">
                              {STATUS_ICON[task.status]}
                              <span className="text-[10px] text-gray-500 capitalize">{task.status.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-gray-400" />
                              <span className="text-[10px] text-gray-500">
                                {overdue ? `Due ${task.assigned_date}` : task.scheduled_time ? `Due ${task.scheduled_time.slice(0, 5)}` : 'Due today'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {task.status !== 'completed' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                          {(task.status === 'pending' || TYPE_PATH[task.task_type]) && (
                            <button
                              onClick={() => startTask(task)}
                              className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors"
                            >
                              {task.status === 'pending' ? 'Start Task' : 'Open'}
                            </button>
                          )}
                          <button
                            onClick={() => setStatus(task, 'completed')}
                            className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors"
                          >
                            Mark Done
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </WorkerLayout>
  )
}
