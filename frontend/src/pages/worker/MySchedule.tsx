import { useEffect, useState } from 'react'
import { Calendar, Clock, Sprout, Truck, CheckCircle2, ClipboardCheck, Wrench } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Schedule } from '../../types'

const TYPE_ICON: Record<string, React.ReactNode> = {
  harvest:     <Sprout   size={15} className="text-green-600" />,
  transport:   <Truck    size={15} className="text-blue-600"  />,
  inspection:  <ClipboardCheck size={15} className="text-purple-600" />,
  maintenance: <Wrench   size={15} className="text-slate-600" />,
  other:       <Calendar size={15} className="text-purple-600"/>,
}

const TYPE_BG: Record<string, string> = {
  harvest:     'bg-green-100',
  transport:   'bg-blue-100',
  inspection:  'bg-purple-100',
  maintenance: 'bg-slate-100',
  other:       'bg-purple-100',
}

type FilterTab = 'all' | 'today' | 'upcoming'

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') would be UTC)
const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function MySchedule() {
  const [activeTab, setActiveTab] = useState<FilterTab>('today')
  const [schedule, setSchedule] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date()
  const todayStr = localDate(today)

  const load = async () => {
    try {
      const data = await apiClient.getMySchedule()
      setSchedule(data.schedules.filter(s => s.status !== 'cancelled'))
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your schedule.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markDone = async (id: number) => {
    try {
      await apiClient.updateScheduleStatus(id, 'completed')
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the task.'))
    }
  }

  const isOverdue = (s: Schedule) => s.assigned_date < todayStr && s.status !== 'completed'

  const filtered = schedule.filter(item => {
    if (activeTab === 'today')    return item.assigned_date === todayStr || isOverdue(item)
    if (activeTab === 'upcoming') return item.assigned_date > todayStr
    return true
  })

  const grouped = filtered.reduce<Record<string, Schedule[]>>((acc, item) => {
    if (!acc[item.assigned_date]) acc[item.assigned_date] = []
    acc[item.assigned_date].push(item)
    return acc
  }, {})

  const todays         = schedule.filter(s => s.assigned_date === todayStr)
  const completedToday = todays.filter(s => s.status === 'completed').length
  const remainingToday = todays.length - completedToday
  const upcomingCount  = schedule.filter(s => s.assigned_date > todayStr).length
  const progress       = todays.length > 0 ? Math.round((completedToday / todays.length) * 100) : 0

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Calendar size={22} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Schedule</h1>
            <p className="text-xs text-gray-500">{today.toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Today progress bar */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-500 rounded-2xl p-4 text-white">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm font-semibold">Today's Progress</p>
              <p className="text-xs text-purple-100">{completedToday} of {todays.length} tasks done</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{progress}%</p>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-xs text-purple-100">{completedToday} Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <span className="text-xs text-purple-100">{remainingToday} Remaining</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-300" />
              <span className="text-xs text-purple-100">{upcomingCount} Upcoming</span>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['today', 'upcoming', 'all'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">{error}</p>
        )}

        {/* Schedule list */}
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading schedule…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Calendar size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {activeTab === 'today' ? 'Nothing scheduled for today' : activeTab === 'upcoming' ? 'No upcoming tasks' : 'No tasks assigned yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {date === todayStr ? 'Today' : formatDay(date)}
                  </p>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] text-gray-400">{items.length} task{items.length === 1 ? '' : 's'}</span>
                </div>

                <div className="space-y-2">
                  {items.map(item => {
                    const done = item.status === 'completed'
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 ${done ? 'opacity-60' : ''}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_BG[item.task_type] ?? TYPE_BG.other}`}>
                          {TYPE_ICON[item.task_type] ?? TYPE_ICON.other}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm leading-tight capitalize ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {item.details || item.task_type}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.scheduled_time && (
                              <>
                                <div className="flex items-center gap-1">
                                  <Clock size={10} className="text-gray-400" />
                                  <span className="text-[10px] text-gray-500">{item.scheduled_time.slice(0, 5)}</span>
                                </div>
                                <span className="text-gray-300">·</span>
                              </>
                            )}
                            <span className="text-[10px] text-gray-500 capitalize">{item.task_type}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-[10px] text-gray-500 capitalize">{item.priority} priority</span>
                          </div>
                        </div>
                        {done ? (
                          <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                        ) : item.assigned_date > todayStr ? (
                          <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-1 rounded-full shrink-0">Soon</span>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            {isOverdue(item) && (
                              <span className="text-[10px] bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full">Overdue</span>
                            )}
                            <button
                              onClick={() => markDone(item.id)}
                              className="text-[10px] bg-green-50 text-green-700 font-semibold px-2.5 py-1.5 rounded-full hover:bg-green-100 transition-colors"
                            >
                              Mark done
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </WorkerLayout>
  )
}
