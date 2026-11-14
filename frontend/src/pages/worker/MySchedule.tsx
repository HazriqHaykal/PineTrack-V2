import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, CalendarX2, CheckCircle2, List, PlayCircle } from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { EmptyState, ErrorNote, ICON_STROKE, Segmented, StatTile, WorkerPage, cardCls } from '../../components/worker/ui'
import { useFarmToday } from '../../hooks/useFarmToday'
import MonthCalendar from '../../components/schedule/MonthCalendar'
import TaskDetailsDialog from '../../components/schedule/TaskDetailsDialog'
import {
  OverdueBadge, PriorityBadge, TaskStatusBadge, addDays, byDateTime, formatDay, formatTime, isOpen, isOverdue, taskLabel,
} from '../../components/schedule/taskMeta'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Schedule } from '../../types'

type Tab = 'today' | 'upcoming' | 'all'
type View = 'list' | 'calendar'

export default function MySchedule() {
  const { today } = useFarmToday()
  const [tasks, setTasks]     = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [view, setView]       = useState<View>('list')
  const [tab, setTab]         = useState<Tab>('today')
  const [month, setMonth]     = useState(() => today.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(today)
  const [viewing, setViewing] = useState<Schedule | null>(null)
  const [busyId, setBusyId]   = useState<number | null>(null)
  const [undo, setUndo]       = useState<{ task: Schedule; prev: Schedule['status'] } | null>(null)
  const undoTimer = useRef<number>()

  const load = useCallback(async () => {
    try {
      // Only tasks assigned to the signed-in worker are returned
      const data = await apiClient.getMySchedule()
      setTasks(data.schedules.filter((s) => s.status !== 'cancelled'))
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your schedule.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  const setStatus = async (task: Schedule, status: Schedule['status']) => {
    setBusyId(task.id)
    try {
      await apiClient.updateScheduleStatus(task.id, status)
      await load()
      return true
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the task.'))
      return false
    } finally {
      setBusyId(null)
    }
  }

  // Pending → Completed is a valid backend transition, so completion is one click
  const complete = async (task: Schedule) => {
    if (await setStatus(task, 'completed')) {
      setViewing(null)
      setUndo({ task, prev: task.status })
      window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => setUndo(null), 6000)
    }
  }
  const start = async (task: Schedule) => {
    if (await setStatus(task, 'in_progress')) setViewing(null)
  }

  const weekEnd = addDays(today, 6)
  const overdue = tasks.filter((t) => isOverdue(t, today))
  const todays = tasks.filter((t) => t.assigned_date === today)
  const upcoming = tasks.filter((t) => isOpen(t) && t.assigned_date > today && t.assigned_date <= weekEnd)

  const listed = (tab === 'today'
    ? [...overdue, ...todays]
    : tab === 'upcoming' ? tasks.filter((t) => t.assigned_date > today)
    : tasks
  ).slice().sort(byDateTime)
  const grouped = listed.reduce<Record<string, Schedule[]>>((acc, t) => { (acc[t.assigned_date] ??= []).push(t); return acc }, {})
  const dayTasks = tasks.filter((t) => t.assigned_date === selectedDay).sort(byDateTime)

  const taskCard = (t: Schedule) => {
    const done = t.status === 'completed'
    const late = isOverdue(t, today)
    return (
      <li key={t.id} className={`${cardCls} overflow-hidden`}>
        <button onClick={() => setViewing(t)} className="w-full text-left px-4 pt-3.5 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold ${done ? 'text-gray-500' : 'text-gray-900'}`}>{taskLabel(t.task_type)}</p>
            {done ? <TaskStatusBadge status={t.status} /> : <PriorityBadge priority={t.priority} />}
          </div>
          {t.details && <p className="mt-0.5 text-sm text-gray-600 line-clamp-2 break-words">{t.details}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="tabular-nums">{t.scheduled_time ? formatTime(t.scheduled_time) : 'Any time'}</span>
            {!done && <><span aria-hidden>·</span><TaskStatusBadge status={t.status} /></>}
            {late && <OverdueBadge />}
          </div>
        </button>
        {!done && (
          <div className="flex gap-2 border-t border-gray-100 px-4 py-2.5">
            {t.status === 'pending' && (
              <button onClick={() => start(t)} disabled={busyId === t.id}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                <PlayCircle size={15} strokeWidth={ICON_STROKE} /> Start
              </button>
            )}
            <button onClick={() => complete(t)} disabled={busyId === t.id}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-sm font-semibold text-white disabled:opacity-60">
              <CheckCircle2 size={15} strokeWidth={2} /> {busyId === t.id ? 'Saving…' : 'Mark as Completed'}
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <WorkerLayout>
      <WorkerPage title="My Schedule"
        subtitle={formatDay(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Today" value={loading ? '—' : todays.filter(isOpen).length} sub="still open" dot="bg-blue-500" />
          <StatTile label="Overdue" value={loading ? '—' : overdue.length} sub="before today" dot="bg-red-500" alert={overdue.length > 0} />
          <StatTile label="Upcoming" value={loading ? '—' : upcoming.length} sub="next 7 days" dot="bg-gray-400" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {view === 'list' ? (
            <Segmented<Tab> label="Which tasks" value={tab} onChange={setTab} options={[
              { value: 'today', label: 'Today', count: loading ? undefined : overdue.length + todays.length },
              { value: 'upcoming', label: 'Upcoming', count: loading ? undefined : tasks.filter((t) => t.assigned_date > today).length },
              { value: 'all', label: 'All' },
            ]} />
          ) : (
            <p className="text-sm font-medium text-gray-700">Calendar</p>
          )}
          <div role="group" aria-label="View" className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {([['list', List, 'List'], ['calendar', CalendarDays, 'Calendar']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} aria-label={`${label} view`}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${
                  view === v ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <Icon size={15} strokeWidth={ICON_STROKE} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Loading schedule…</p>
        ) : view === 'calendar' ? (
          <div className="space-y-4">
            <div className={`${cardCls} p-3`}>
              <MonthCalendar compact tasks={tasks} today={today} month={month} onMonthChange={setMonth}
                selected={selectedDay} onSelect={setSelectedDay} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                {selectedDay === today ? 'Today' : formatDay(selectedDay, { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              {dayTasks.length === 0
                ? <p className={`${cardCls} p-6 text-center text-sm text-gray-500`}>No tasks on this day.</p>
                : <ul className="space-y-2">{dayTasks.map(taskCard)}</ul>}
            </div>
          </div>
        ) : listed.length === 0 ? (
          <EmptyState icon={tab === 'today' ? CheckCircle2 : CalendarX2}
            title={tab === 'today' ? 'Nothing due today' : tab === 'upcoming' ? 'No upcoming tasks' : 'No tasks assigned yet'}
            body={tab === 'today'
              ? 'You are all caught up. Check Upcoming for work later this week.'
              : 'Tasks your supervisor assigns to you will appear here.'}
            action={tab === 'today' ? (
              <button onClick={() => setTab('upcoming')} className="text-sm font-medium text-green-800 hover:underline">See upcoming tasks</button>
            ) : undefined} />
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
              <section key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${date < today ? 'text-red-700' : 'text-gray-600'}`}>
                    {date === today ? 'Today' : formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-500">{items.length} task{items.length === 1 ? '' : 's'}</span>
                </div>
                <ul className="space-y-2">{items.map(taskCard)}</ul>
              </section>
            ))}
          </div>
        )}
      </WorkerPage>

      <TaskDetailsDialog task={viewing} today={today} onClose={() => setViewing(null)}
        worker={{ onStart: start, onComplete: complete }} busy={viewing ? busyId === viewing.id : false} />

      {undo && (
        <div role="status" className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] xl:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          <span>{taskLabel(undo.task.task_type)} marked completed</span>
          <button className="font-semibold text-green-300 hover:text-green-200"
            onClick={() => { const u = undo; setUndo(null); setStatus(u.task, u.prev) }}>
            Undo
          </button>
        </div>
      )}
    </WorkerLayout>
  )
}
