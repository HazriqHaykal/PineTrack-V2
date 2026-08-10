import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, AlertCircle, Sprout, Truck, Recycle, ChevronRight, Sun } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { authService } from '../../services/auth'

interface Task {
  id: number
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed'
  due_time: string
  type: 'harvest' | 'transport' | 'waste' | 'general'
}

const DEMO_TASKS: Task[] = [
  { id: 1, title: 'Harvest Block A-3', description: 'Pick ripe pineapples from block A-3, approx 200 units', priority: 'high', status: 'in_progress', due_time: '10:00 AM', type: 'harvest' },
  { id: 2, title: 'Transport to Cold Storage', description: 'Move harvested batch PT-2024-001 to cold storage unit 2', priority: 'high', status: 'pending', due_time: '11:30 AM', type: 'transport' },
  { id: 3, title: 'Log Waste from Block B-1', description: 'Record and dispose overripe waste from yesterday harvest', priority: 'medium', status: 'pending', due_time: '2:00 PM', type: 'waste' },
  { id: 4, title: 'Quality Check Block C', description: 'Inspect pineapples in block C for harvest readiness', priority: 'low', status: 'pending', due_time: '3:30 PM', type: 'general' },
]

const PRIORITY_STYLES = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    label: 'High'   },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', label: 'Medium' },
  low:    { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',   label: 'Low'    },
}

const STATUS_ICON = {
  pending:     <Clock size={15} className="text-gray-400" />,
  in_progress: <AlertCircle size={15} className="text-amber-500" />,
  completed:   <CheckCircle2 size={15} className="text-green-500" />,
}

const TYPE_ICON = {
  harvest:   <Sprout size={16} className="text-green-600" />,
  transport: <Truck size={16} className="text-blue-600" />,
  waste:     <Recycle size={16} className="text-orange-600" />,
  general:   <CheckCircle2 size={16} className="text-purple-600" />,
}

const TYPE_PATH = {
  harvest:   '/harvest-entry',
  transport: '/transport-update',
  waste:     '/waste-submit',
  general:   '/my-schedule',
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const user = authService.getUser()
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS)
  const [greeting, setGreeting] = useState('Good morning')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  const pending   = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const completed = tasks.filter(t => t.status === 'completed').length

  const markDone = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const } : t))
  }

  const today = new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric' })

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

          <div className="space-y-3">
            {tasks.map(task => {
              const p = PRIORITY_STYLES[task.priority]
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
                        {TYPE_ICON[task.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{task.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            {STATUS_ICON[task.status]}
                            <span className="text-[10px] text-gray-500 capitalize">{task.status.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={11} className="text-gray-400" />
                            <span className="text-[10px] text-gray-500">Due {task.due_time}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {task.status !== 'completed' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => navigate(TYPE_PATH[task.type])}
                          className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors"
                        >
                          Start Task
                        </button>
                        <button
                          onClick={() => markDone(task.id)}
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
        </div>

      </div>
    </WorkerLayout>
  )
}
