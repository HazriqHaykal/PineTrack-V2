import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Eye, List, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useCreateFromQuery } from '../../hooks/useCreateFromQuery'
import { useFarmToday } from '../../hooks/useFarmToday'
import IconButton from '../../components/ui/IconButton'
import { ConfirmDialog, Dialog, btnPrimary, btnSecondary } from '../../components/ui/Dialog'
import MonthCalendar from '../../components/schedule/MonthCalendar'
import TaskDetailsDialog from '../../components/schedule/TaskDetailsDialog'
import {
  LEGACY_CATEGORIES, OverdueBadge, POST_HARVEST_CATEGORIES, PRIORITIES, PriorityBadge, SUPPORTING_CATEGORIES,
  TASK_STATUSES, TASK_STATUS_META, TaskStatus, TaskStatusBadge, addDays, byDateTime, formatDay, formatTime,
  isOpen, isOverdue, matchesFilters, taskLabel,
} from '../../components/schedule/taskMeta'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Schedule, SystemUser } from '../../types'
import AppSelect from '../../components/ui/AppSelect'
import SearchableSelect from '../../components/ui/SearchableSelect'

import { tr, trEnum } from '../../i18n'
// ── Form ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  task_type:      'inspection' as string,
  details:        '',
  worker_id:      '',
  assigned_date:  '',
  scheduled_time: '',
  priority:       'medium',
  status:         'pending' as TaskStatus,
}
type FormState = typeof EMPTY_FORM
type FormErrors = Partial<Record<keyof FormState, string>>

function validate(f: FormState): FormErrors {
  const e: FormErrors = {}
  if (!f.task_type) e.task_type = tr("Choose a task category.")
  if (!f.worker_id) e.worker_id = tr("Choose who will do this task.")
  if (!f.assigned_date) e.assigned_date = tr("Choose the date the task is scheduled for.")
  return e
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 ${
    err ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-green-600'
  }`

function Field({ id, label, required, hint, error, className, children }: {
  id: string; label: string; required?: boolean; hint?: React.ReactNode; error?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function FormSection({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h4 className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 mb-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-50 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-200">{step}</span>
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div role="status" className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
    }`}>{msg}</div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type View = 'calendar' | 'list'
const ALL_CATEGORIES = [...POST_HARVEST_CATEGORIES, ...SUPPORTING_CATEGORIES, ...LEGACY_CATEGORIES]

export default function SchedulePage() {
  const { today, timeZone } = useFarmToday()
  const [tasks, setTasks]       = useState<Schedule[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workers, setWorkers]   = useState<SystemUser[]>([])

  const [view, setView]         = useState<View>('calendar')
  const [month, setMonth]       = useState(() => today.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(today)

  const [statusF, setStatusF]   = useState<'all' | TaskStatus>('all')
  const [categoryF, setCategoryF] = useState('all')
  const [workerF, setWorkerF]   = useState('all')
  const [fromF, setFromF]       = useState('')
  const [toF, setToF]           = useState('')

  const [viewing, setViewing]   = useState<Schedule | null>(null)
  const [modalOpen, setModal]   = useState(false)
  const [editing, setEditing]   = useState<Schedule | null>(null)
  const [form, setForm]         = useState<FormState>({ ...EMPTY_FORM })
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<Schedule | null>(null)
  const [busy, setBusy]         = useState(false)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // When the farm timezone loads and shifts "today", follow it if the user hasn't navigated yet
  useEffect(() => { setMonth(today.slice(0, 7)); setSelectedDay(today) }, [today])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      // The API has no date-range filter, so the calendar works from one bounded fetch
      const d = await apiClient.listSchedules(0, 1000)
      setTasks(d.items || [])
      setTotal(d.total ?? d.items.length)
      setLoadError(null)
    } catch (err) {
      setLoadError(apiErrorMessage(err, tr("Failed to load tasks")))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    apiClient.listUsers().then((d) => setWorkers(d.items.filter((u) => u.is_active))).catch(() => setWorkers([]))
  }, [load])

  // ── Form ──

  const openCreate = (date?: string) => {
    setEditing(null)
    const firstWorker = workers.find((w) => w.role === 'worker')
    setForm({ ...EMPTY_FORM, assigned_date: date ?? today, worker_id: firstWorker ? String(firstWorker.id) : '' })
    setShowErrors(false)
    setSubmitError(null)
    setModal(true)
  }
  useCreateFromQuery(() => openCreate())

  const openEdit = (s: Schedule) => {
    setViewing(null)
    setEditing(s)
    setForm({
      task_type:      s.task_type,
      details:        s.details || '',
      worker_id:      String(s.worker_id),
      assigned_date:  s.assigned_date,
      scheduled_time: formatTime(s.scheduled_time),
      priority:       s.priority || 'medium',
      status:         s.status,
    })
    setShowErrors(false)
    setSubmitError(null)
    setModal(true)
  }

  const errors = validate(form)
  const err = (k: keyof FormState) => (showErrors ? errors[k] : undefined)
  const set = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setSubmitError(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(errors).length) return
    setSubmitting(true)
    const payload: Partial<Schedule> = {
      task_type:      form.task_type as Schedule['task_type'],
      details:        form.details.trim() || null,
      worker_id:      parseInt(form.worker_id),
      assigned_date:  form.assigned_date,
      scheduled_time: form.scheduled_time || null,
      priority:       form.priority as Schedule['priority'],
    }
    try {
      if (editing) {
        await apiClient.updateSchedule(editing.id, { ...payload, status: form.status })
        showToast(tr("Task updated"), 'success')
      } else {
        await apiClient.createSchedule({ ...payload, status: 'pending' })
        showToast(tr("Task scheduled"), 'success')
      }
      setModal(false)
      load()
    } catch (e2) {
      setSubmitError(apiErrorMessage(e2, tr("Failed to save the task")))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiClient.deleteSchedule(deleting.id)
      showToast(tr("Task deleted"), 'success')
      setDeleting(null)
      setViewing(null)
      load()
    } catch (e) {
      showToast(apiErrorMessage(e, tr("Delete failed")), 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Derived data ──

  const workerOptions = useMemo(() => {
    const map = new Map<number, string>()
    workers.forEach((w) => map.set(w.id, w.full_name || w.username))
    // Keep tasks of deactivated accounts filterable
    tasks.forEach((t) => { if (!map.has(t.worker_id)) map.set(t.worker_id, t.worker_name || tr("Worker #{0}", t.worker_id)) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [workers, tasks])

  const filters = { status: statusF, category: categoryF, worker: workerF, from: fromF, to: toF }

  const calendarTasks = tasks.filter((t) => matchesFilters(t, filters, false))
  const listTasks = tasks.filter((t) => matchesFilters(t, filters)).sort((a, b) => byDateTime(b, a))
  const dayTasks = calendarTasks.filter((t) => t.assigned_date === selectedDay).sort(byDateTime)

  const filtersActive = statusF !== 'all' || categoryF !== 'all' || workerF !== 'all' || (view === 'list' && (!!fromF || !!toF))
  const clearFilters = () => { setStatusF('all'); setCategoryF('all'); setWorkerF('all'); setFromF(''); setToF('') }
  const rangeError = fromF && toF && fromF > toF ? tr("The start date is after the end date.") : null

  const weekEnd = addDays(today, 6)
  const monthAgo = addDays(today, -29)
  const cards = [
    { label: tr("Upcoming"), value: tasks.filter((t) => isOpen(t) && t.assigned_date >= today && t.assigned_date <= weekEnd).length,
      period: tr("Open tasks, next 7 days"), tone: 'text-gray-900' },
    { label: tr("Overdue"), value: tasks.filter((t) => isOverdue(t, today)).length,
      period: tr("Still open, scheduled before today"), tone: 'text-red-700' },
    { label: tr("Completed"), value: tasks.filter((t) => t.status === 'completed' && t.assigned_date >= monthAgo && t.assigned_date <= today).length,
      period: tr("Scheduled in the last 30 days"), tone: 'text-gray-900' },
  ]

  const categoriesForForm = editing && LEGACY_CATEGORIES.some((c) => c.value === form.task_type)
    ? LEGACY_CATEGORIES.filter((c) => c.value === form.task_type) : []
  const categoryHint = ALL_CATEGORIES.find((c) => c.value === form.task_type)?.hint

  // ── Render helpers ──

  const dayTaskRow = (t: Schedule) => (
    <li key={t.id}>
      <button onClick={() => setViewing(t)}
        className="w-full text-left rounded-lg border border-gray-200 px-3 py-2.5 hover:border-gray-300 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${t.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{taskLabel(t.task_type)}</p>
          <TaskStatusBadge status={t.status} />
        </div>
        <p className="mt-0.5 text-xs text-gray-600">
          {t.scheduled_time ? <span className="tabular-nums">{formatTime(t.scheduled_time)} · </span> : tr("Any time · ")}
          {t.worker_name || tr("Worker #{0}", t.worker_id)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={t.priority} />
          {isOverdue(t, today) && <OverdueBadge />}
        </div>
      </button>
    </li>
  )

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tr("Post-Harvest Scheduling")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tr("Plan post-harvest activities and monitor assigned workers.")}</p>
          </div>
          <button onClick={() => openCreate(view === 'calendar' ? selectedDay : undefined)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto">
            <Plus size={16} strokeWidth={2} /> {tr("New Task")}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-0.5 tabular-nums ${c.value ? c.tone : 'text-gray-900'}`}>{loading ? '—' : c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.period}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-6">
          {tr("Today is")} {formatDay(today)}{timeZone ? tr(" ({0}, farm timezone)", timeZone) : tr(" (this device’s timezone; farm settings unavailable)")}.
        </p>

        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-end gap-3 mb-5">
          <div role="tablist" aria-label={tr("View")} className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
            {([['calendar', tr("Calendar"), CalendarDays], ['list', tr("List"), List]] as const).map(([v, label, Icon]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium transition-colors ${
                  view === v ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                <Icon size={15} strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2 xl:ml-auto">
            <FilterSelect label={tr("Status")} value={statusF} onChange={(v) => setStatusF(v as 'all' | TaskStatus)}
              options={[['all', tr("All statuses")], ...TASK_STATUSES.map((s) => [s, TASK_STATUS_META[s].label] as [string, string])]} />
            <FilterSelect label={tr("Category")} value={categoryF} onChange={setCategoryF}
              options={[['all', tr("All categories")], ...ALL_CATEGORIES.map((c) => [c.value, c.label] as [string, string])]} />
            <FilterSelect label={tr("Worker")} value={workerF} onChange={setWorkerF}
              options={[['all', tr("All workers")], ...workerOptions.map(([id, name]) => [String(id), name] as [string, string])]} />
            {view === 'list' && (
              <>
                <DateFilter label={tr("From")} value={fromF} onChange={setFromF} />
                <DateFilter label={tr("To")} value={toF} onChange={setToF} />
              </>
            )}
            {filtersActive && (
              <button onClick={clearFilters} className="h-9 inline-flex items-center gap-1 px-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                <X size={14} /> {tr("Clear")}
              </button>
            )}
          </div>
        </div>
        {rangeError && view === 'list' && <p className="-mt-3 mb-4 text-xs text-red-700">{rangeError}</p>}
        {total > tasks.length && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {tr("Showing the")} {tasks.length} {tr("most recent of")} {total} {tr("tasks. Older tasks are not loaded.")}
          </p>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100 text-sm text-gray-500">
            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-3" />
            {tr("Loading tasks…")}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100 text-center px-4">
            <AlertTriangle size={30} className="text-gray-300 mb-2" />
            <p className="font-medium text-gray-800">{tr("Could not load tasks")}</p>
            <p className="text-sm text-gray-500 mt-1">{loadError}</p>
            <button onClick={() => { setLoading(true); load() }} className={`${btnSecondary} mt-4 inline-flex items-center gap-1.5`}>
              <RefreshCw size={14} strokeWidth={1.75} /> {tr("Try again")}
            </button>
          </div>
        ) : view === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <MonthCalendar tasks={calendarTasks} today={today} month={month} onMonthChange={setMonth}
                selected={selectedDay} onSelect={setSelectedDay} onOpenTask={setViewing} />
            </div>
            <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 self-start" aria-live="polite">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{selectedDay === today ? tr("Today") : formatDay(selectedDay, { weekday: 'long' })}</h3>
                  <p className="text-xs text-gray-500">{formatDay(selectedDay, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => openCreate(selectedDay)}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Plus size={14} /> {tr("Add")}
                </button>
              </div>
              {dayTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {tasks.length === 0 ? tr("No tasks have been scheduled yet.") : filtersActive ? tr("No tasks on this day match the filters.") : tr("Nothing scheduled on this day.")}
                </p>
              ) : (
                <ul className="space-y-2">{dayTasks.map(dayTaskRow)}</ul>
              )}
            </aside>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {listTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <p className="font-medium text-gray-800">{tasks.length === 0 ? tr("No tasks yet") : tr("No tasks match these filters")}</p>
                {tasks.length === 0
                  ? <p className="text-sm text-gray-500 mt-1">{tr("Create a task to start planning post-harvest work.")}</p>
                  : <button onClick={clearFilters} className="mt-2 text-sm font-medium text-green-800 hover:underline">{tr("Clear filters")}</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[[tr("Task"), 'w-[32%]'], [tr("Scheduled"), ''], [tr("Worker"), ''], [tr("Priority"), ''], [tr("Status"), ''], [tr("Actions"), 'text-right']].map(([h, cls]) => (
                        <th key={h} className={`text-left px-4 py-3 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listTasks.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                        <td className="px-4 py-3">
                          <button onClick={() => setViewing(t)} className="text-left">
                            <span className={`font-semibold hover:text-green-800 ${t.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{taskLabel(t.task_type)}</span>
                            {t.details && <span className="block max-w-[320px] truncate text-xs text-gray-500 mt-0.5" title={t.details}>{t.details}</span>}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          <span className="tabular-nums">{formatDay(t.assigned_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {t.scheduled_time && <span className="tabular-nums text-gray-500"> · {formatTime(t.scheduled_time)}</span>}
                          {isOverdue(t, today) && <span className="ml-2"><OverdueBadge /></span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{t.worker_name || tr("Worker #{0}", t.worker_id)}</td>
                        <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton icon={Eye} label={tr("View progress of task #{0}", t.id)} onClick={() => setViewing(t)} />
                            <IconButton icon={Pencil} label={tr("Edit task #{0}", t.id)} onClick={() => openEdit(t)} />
                            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
                            <IconButton icon={Trash2} label={tr("Delete task #{0}", t.id)} danger onClick={() => setDeleting(t)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {!loading && !loadError && view === 'list' && filtersActive && listTasks.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{tr("Showing")} {listTasks.length} {tr("of")} {tasks.length} {tr("tasks")}</p>
        )}
      </div>

      <TaskDetailsDialog task={viewing} today={today} onClose={() => setViewing(null)}
        admin={{ onEdit: openEdit, onDelete: (t) => setDeleting(t) }} />

      {/* Create / edit */}
      <Dialog
        open={modalOpen}
        size="lg"
        title={editing ? tr("Edit Task #{0}", editing.id) : tr("New Task")}
        subtitle={editing ? tr("Assigned to {0}", editing.worker_name || `worker #${editing.worker_id}`) : tr("New tasks start as Pending; the worker updates progress.")}
        onClose={() => setModal(false)}
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className={btnSecondary}>{tr("Cancel")}</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? tr("Saving…") : editing ? tr("Save Changes") : tr("Create Task")}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {submitError && (
            <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />{submitError}
            </p>
          )}

          <FormSection step="A" title={tr("Task Information")}>
            <Field id="task_type" label={tr("Task category")} required error={err('task_type')} hint={categoryHint} className="sm:col-span-2">
              <AppSelect id="task_type" value={form.task_type} onChange={(v) => set({ task_type: v })} error={!!err('task_type')}
                aria-describedby={`task_type-${err('task_type') ? 'error' : 'hint'}`}
                groups={[
                  { label: tr("Post-harvest"), options: POST_HARVEST_CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
                  { label: tr("Coordination and other"), options: SUPPORTING_CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
                  ...(categoriesForForm.length > 0
                    ? [{ label: tr("Legacy"), options: categoriesForForm.map((c) => ({ value: c.value, label: c.label })) }]
                    : []),
                ]} />
            </Field>
          </FormSection>

          <FormSection step="B" title={tr("Assignment")}>
            <Field id="worker_id" label={tr("Assigned worker")} required error={err('worker_id')} className="sm:col-span-2">
              <SearchableSelect id="worker_id" value={form.worker_id} onChange={(v) => set({ worker_id: v })} error={!!err('worker_id')}
                placeholder={tr("Select a worker…")} searchPlaceholder={tr("Search workers")} noResultsText={tr("No workers match")}
                options={[
                  ...workers.map((w) => ({
                    value: String(w.id), label: `${w.full_name || w.username}${w.role === 'admin' ? ' (admin)' : ''}`, keywords: w.username,
                  })),
                  ...(editing && !workers.some((w) => String(w.id) === form.worker_id)
                    ? [{ value: String(editing.worker_id), label: tr("{0} (inactive)", editing.worker_name || `Worker #${editing.worker_id}`) }]
                    : []),
                ]} />
            </Field>
            <Field id="assigned_date" label={tr("Scheduled date")} required error={err('assigned_date')}
              hint={!editing && form.assigned_date && form.assigned_date < today ? tr("This date is in the past; the task will show as overdue.") : undefined}>
              <input id="assigned_date" type="date" value={form.assigned_date} onChange={(e) => set({ assigned_date: e.target.value })}
                className={inputCls(err('assigned_date'))} />
            </Field>
            <Field id="scheduled_time" label={tr("Scheduled time")} hint={tr("Optional")}>
              <input id="scheduled_time" type="time" value={form.scheduled_time} onChange={(e) => set({ scheduled_time: e.target.value })}
                className={inputCls()} />
            </Field>
            <Field id="priority" label={tr("Priority")}>
              <AppSelect id="priority" value={form.priority} onChange={(v) => set({ priority: v })}
                options={PRIORITIES.map((p) => ({ value: p, label: trEnum(p).replace(/^\w/, (c) => c.toUpperCase()) }))} />
            </Field>
            {editing && (
              <Field id="status" label={tr("Status")} hint={tr("Normally updated by the worker.")}>
                <AppSelect id="status" value={form.status} onChange={(v) => set({ status: v as TaskStatus })}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))} />
              </Field>
            )}
          </FormSection>

          <FormSection step="C" title={tr("Additional Information")}>
            <Field id="details" label={tr("Description and instructions")} className="sm:col-span-2"
              hint={tr("Optional. For example the batch number, quantity, or packing standard to follow.")}>
              <textarea id="details" rows={4} value={form.details} onChange={(e) => set({ details: e.target.value })}
                placeholder={tr("What should the worker do?")} className={`${inputCls()} resize-none`} />
            </Field>
          </FormSection>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={tr("Delete this task?")}
        body={deleting && (
          <>
            <p className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-800">
              <span className="font-medium">{taskLabel(deleting.task_type)}</span>
              <span className="text-gray-600"> · {formatDay(deleting.assigned_date)} · {deleting.worker_name || tr("Worker #{0}", deleting.worker_id)}</span>
            </p>
            {tr("The task is removed permanently and disappears from the worker’s schedule. To keep a record, set its status to Cancelled instead.")}
          </>
        )}
        confirmLabel={tr("Delete")}
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500" aria-hidden>{label}</span>
      <AppSelect size="sm" aria-label={label} value={value} onChange={onChange} highlighted={value !== 'all'}
        triggerClassName="min-w-[9rem]" options={options.map(([v, l]) => ({ value: v, label: l }))} />
    </div>
  )
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className={`h-9 px-2.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600 ${
          value ? 'border-green-600 text-gray-900' : 'border-gray-200 text-gray-700'
        }`} />
    </label>
  )
}
