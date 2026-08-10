import { useState } from 'react'
import { Calendar, Clock, Sprout, Truck, Recycle, CheckCircle2, ChevronRight } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'

interface ScheduleItem {
  id: number
  date: string
  time: string
  task: string
  type: 'harvest' | 'transport' | 'waste' | 'general'
  location: string
  status: 'upcoming' | 'today' | 'completed'
  duration: string
}

const today = new Date()
const fmt = (offset: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })
}

const DEMO_SCHEDULE: ScheduleItem[] = [
  { id: 1,  date: fmt(0),  time: '07:00',  task: 'Morning Field Inspection',      type: 'general',   location: 'Block A',           status: 'completed', duration: '1h' },
  { id: 2,  date: fmt(0),  time: '09:30',  task: 'Harvest Block A-3',             type: 'harvest',   location: 'Block A-3',         status: 'today',     duration: '3h' },
  { id: 3,  date: fmt(0),  time: '13:00',  task: 'Transport to Cold Storage',     type: 'transport', location: 'Cold Storage Unit 2',status: 'today',     duration: '1.5h'},
  { id: 4,  date: fmt(0),  time: '15:30',  task: 'Log Waste from Block B',        type: 'waste',     location: 'Block B-1',         status: 'today',     duration: '30m'},
  { id: 5,  date: fmt(1),  time: '08:00',  task: 'Harvest Block C',               type: 'harvest',   location: 'Block C',           status: 'upcoming',  duration: '4h' },
  { id: 6,  date: fmt(1),  time: '14:00',  task: 'Transport to Market',           type: 'transport', location: 'Market Dock 4',     status: 'upcoming',  duration: '2h' },
  { id: 7,  date: fmt(2),  time: '07:30',  task: 'Full Farm Inspection',          type: 'general',   location: 'All Blocks',        status: 'upcoming',  duration: '3h' },
  { id: 8,  date: fmt(2),  time: '11:00',  task: 'Harvest Block D',               type: 'harvest',   location: 'Block D',           status: 'upcoming',  duration: '4h' },
]

const TYPE_ICON = {
  harvest:   <Sprout   size={15} className="text-green-600" />,
  transport: <Truck    size={15} className="text-blue-600"  />,
  waste:     <Recycle  size={15} className="text-orange-500"/>,
  general:   <Calendar size={15} className="text-purple-600"/>,
}

const TYPE_BG = {
  harvest:   'bg-green-100',
  transport: 'bg-blue-100',
  waste:     'bg-orange-100',
  general:   'bg-purple-100',
}

type FilterTab = 'all' | 'today' | 'upcoming'

export default function MySchedule() {
  const [activeTab, setActiveTab] = useState<FilterTab>('today')

  const filtered = DEMO_SCHEDULE.filter(item => {
    if (activeTab === 'all')      return true
    if (activeTab === 'today')    return item.status === 'today' || item.status === 'completed'
    if (activeTab === 'upcoming') return item.status === 'upcoming'
    return true
  })

  const grouped = filtered.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = []
    acc[item.date].push(item)
    return acc
  }, {})

  const todayCount    = DEMO_SCHEDULE.filter(s => s.status === 'today').length
  const completedToday = DEMO_SCHEDULE.filter(s => s.status === 'completed').length
  const upcomingCount = DEMO_SCHEDULE.filter(s => s.status === 'upcoming').length

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
              <p className="text-xs text-purple-100">{completedToday} of {completedToday + todayCount} tasks done</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {completedToday + todayCount > 0
                  ? Math.round((completedToday / (completedToday + todayCount)) * 100)
                  : 0}%
              </p>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${completedToday + todayCount > 0 ? (completedToday / (completedToday + todayCount)) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-xs text-purple-100">{completedToday} Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <span className="text-xs text-purple-100">{todayCount} Remaining</span>
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

        {/* Schedule list */}
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{date}</p>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400">{items.length} tasks</span>
              </div>

              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 ${
                      item.status === 'completed' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_BG[item.type]}`}>
                      {TYPE_ICON[item.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm leading-tight ${item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.task}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-gray-400" />
                          <span className="text-[10px] text-gray-500">{item.time}</span>
                        </div>
                        <span className="text-gray-300">·</span>
                        <span className="text-[10px] text-gray-500">{item.duration}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-[10px] text-gray-500 truncate">{item.location}</span>
                      </div>
                    </div>
                    {item.status === 'completed' ? (
                      <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                    ) : item.status === 'today' ? (
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-1 rounded-full shrink-0">Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </WorkerLayout>
  )
}
