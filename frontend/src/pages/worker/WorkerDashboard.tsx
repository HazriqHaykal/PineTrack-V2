import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Clock, PackageOpen, PlayCircle, Recycle, Sprout, Truck,
} from 'lucide-react'
import WorkerLayout from '../../components/layout/WorkerLayout'
import { ErrorNote, EmptyState, ICON_STROKE, ListHeading, StatTile, WorkerPage, cardCls } from '../../components/worker/ui'
import {
  OverdueBadge, PriorityBadge, TASK_STATUS_META, TaskStatusBadge, byDateTime, formatDay, formatTime, isOverdue, taskLabel,
} from '../../components/schedule/taskMeta'
import { useFarmToday } from '../../hooks/useFarmToday'
import { authService } from '../../services/auth'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Schedule } from '../../types'

import { tr } from '../../i18n'
/** Page where the work for each task type is recorded */
const TYPE_PATH: Record<string, string> = {
  harvest:               '/harvest-entry',
  sorting_grading:       '/harvest-entry',
  transport:             '/transport-update',
  transport_preparation: '/transport-update',
  waste_handling:        '/waste-submit',
}

const QUICK_ACTIONS = [
  { label: tr("New Harvest"), hint: tr("Record and grade a batch"), icon: Sprout,  path: '/harvest-entry' },
  { label: tr("Deliveries"),  hint: tr("Update transport status"),  icon: Truck,   path: '/transport-update' },
  { label: tr("Log Waste"),   hint: tr("Record unusable produce"),  icon: Recycle, path: '/waste-submit' },
]

function greetingFor(hour: number) {
  return tr(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const { today } = useFarmToday()
  const user = authService.getUser()
  const [tasks, setTasks] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async () => {
    try {
      const data = await apiClient.getMySchedule()
      // Today's tasks, plus anything older that is still open
      setTasks(data.schedules.filter(t =>
        t.status !== 'cancelled' &&
        (t.assigned_date === today || (t.assigned_date < today && t.status !== 'completed'))
      ).sort(byDateTime))
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not load your tasks.")))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [today])

  const setStatus = async (task: Schedule, status: Schedule['status']) => {
    setBusyId(task.id)
    try {
      await apiClient.updateScheduleStatus(task.id, status)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, tr("Could not update the task.")))
    } finally {
      setBusyId(null)
    }
  }

  const startTask = async (task: Schedule) => {
    if (task.status === 'pending') await setStatus(task, 'in_progress')
    const path = TYPE_PATH[task.task_type]
    if (path) navigate(path)
  }

  const counts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }
  const open = counts.pending + counts.in_progress
  const name = user?.full_name || user?.username || tr("Worker")

  return (
    <WorkerLayout>
      <WorkerPage title={tr("My Tasks")} subtitle={formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}>

        {/* Greeting */}
        <section className="rounded-xl bg-green-800 px-5 py-4 text-white">
          <p className="text-sm text-green-100">{greetingFor(new Date().getHours())},</p>
          <p className="text-lg font-semibold leading-snug truncate">{name}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-green-50">
            <CalendarCheck size={15} strokeWidth={ICON_STROKE} />
            {loading ? tr("Checking your tasks…")
              : open === 0 ? tr("Nothing left to do today")
              : tr("{0} task{1} still to do today", open, open === 1 ? '' : 's')}
          </p>
        </section>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {(['pending', 'in_progress', 'completed'] as const).map((s) => (
            <StatTile key={s} label={s === 'completed' ? tr("Done") : TASK_STATUS_META[s].label}
              value={loading ? '—' : counts[s]} dot={TASK_STATUS_META[s].dot} />
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <ListHeading>{tr("Quick Actions")}</ListHeading>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_ACTIONS.map(({ label, hint, icon: Icon, path }) => (
              <Link key={path} to={path}
                className={`${cardCls} flex flex-col items-center gap-2 px-2 py-3.5 text-center transition-colors hover:border-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 sm:flex-row sm:text-left sm:px-4`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800">
                  <Icon size={20} strokeWidth={ICON_STROKE} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 leading-tight">{label}</span>
                  <span className="hidden sm:block text-xs text-gray-500 truncate">{hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Today's tasks */}
        <div>
          <ListHeading action={
            <Link to="/my-schedule" className="inline-flex items-center gap-0.5 text-sm font-medium text-green-800 hover:underline">
              {tr("Full schedule")} <ChevronRight size={15} />
            </Link>
          }>
            {tr("Today's Tasks")}
          </ListHeading>

          {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">{tr("Loading tasks…")}</p>
          ) : tasks.length === 0 ? (
            <EmptyState icon={PackageOpen} title={tr("No tasks for today")}
              body={tr("When your supervisor assigns you work, it will appear here. You can still record a harvest or log waste above.")} />
          ) : (
            <ul className="space-y-3">
              {tasks.map(task => {
                const done = task.status === 'completed'
                const late = isOverdue(task, today)
                const path = TYPE_PATH[task.task_type]
                return (
                  <li key={task.id} className={`${cardCls} overflow-hidden ${done ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        {done ? <CheckCircle2 size={18} strokeWidth={ICON_STROKE} className="text-green-700" />
                          : <ClipboardCheck size={18} strokeWidth={ICON_STROKE} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {taskLabel(task.task_type)}
                          </p>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        {task.details && <p className="mt-0.5 text-sm text-gray-600 line-clamp-2 break-words">{task.details}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                          <TaskStatusBadge status={task.status} />
                          {late && <OverdueBadge />}
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} strokeWidth={ICON_STROKE} />
                            {late ? formatDay(task.assigned_date, { day: 'numeric', month: 'short' })
                              : task.scheduled_time ? formatTime(task.scheduled_time) : tr("Any time today")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!done && (
                      <div className="flex gap-2 border-t border-gray-100 px-4 py-2.5">
                        {(task.status === 'pending' || path) && (
                          <button onClick={() => startTask(task)} disabled={busyId === task.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                            <PlayCircle size={15} strokeWidth={ICON_STROKE} />
                            {task.status === 'pending' ? tr("Start") : tr("Open")}
                          </button>
                        )}
                        <button onClick={() => setStatus(task, 'completed')} disabled={busyId === task.id}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
                          <CheckCircle2 size={15} strokeWidth={2} /> {busyId === task.id ? tr("Saving…") : tr("Mark as Completed")}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </WorkerPage>
    </WorkerLayout>
  )
}
