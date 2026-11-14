import { Schedule } from '../../types'

// ── Categories ───────────────────────────────────────────────────────────────

export type TaskType = Schedule['task_type']

export interface TaskCategory {
  value: TaskType
  label: string
  hint: string
}

/** Offered first when creating a task, in the order the work happens after harvest */
export const POST_HARVEST_CATEGORIES: TaskCategory[] = [
  { value: 'inspection',            label: 'Quality Inspection',    hint: 'Check fruit condition. Grades are recorded manually.' },
  { value: 'sorting_grading',       label: 'Sorting and Grading',   hint: 'Separate fruit by size and grade.' },
  { value: 'packaging',             label: 'Packaging',             hint: 'Pack graded fruit for dispatch.' },
  { value: 'transport_preparation', label: 'Transport Preparation', hint: 'Stage and load cargo for a delivery.' },
  { value: 'transport',             label: 'Delivery',              hint: 'Drive or accompany a delivery.' },
  { value: 'waste_handling',        label: 'Waste Handling',        hint: 'Collect, classify and dispose of waste.' },
]

/** Still valid for coordination and for historical tasks */
export const SUPPORTING_CATEGORIES: TaskCategory[] = [
  { value: 'harvest', label: 'Harvest Coordination', hint: 'Coordinate picking and handover to post-harvest.' },
  { value: 'other',   label: 'Other',                hint: 'Anything not covered above.' },
]

/** Kept only so old records display and can still be edited; never offered for new tasks */
export const LEGACY_CATEGORIES: TaskCategory[] = [
  { value: 'maintenance', label: 'Maintenance (legacy)', hint: 'General farm maintenance, from before post-harvest categories.' },
]

const ALL = [...POST_HARVEST_CATEGORIES, ...SUPPORTING_CATEGORIES, ...LEGACY_CATEGORIES]

export const taskLabel = (type: string) =>
  ALL.find((c) => c.value === type)?.label ?? type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

// ── Status & priority ────────────────────────────────────────────────────────

export type TaskStatus = Schedule['status']
export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

export const TASK_STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string }> = {
  pending:     { label: 'Pending',     badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-50 text-blue-800 ring-blue-200',    dot: 'bg-blue-500' },
  completed:   { label: 'Completed',   badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600' },
  cancelled:   { label: 'Cancelled',   badge: 'bg-gray-100 text-gray-600 ring-gray-200',   dot: 'bg-gray-400' },
}
const statusMeta = (s: string) => TASK_STATUS_META[s as TaskStatus] ?? TASK_STATUS_META.pending

export const PRIORITIES = ['high', 'medium', 'low'] as const
const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High',   cls: 'text-red-700 bg-red-50 ring-red-200' },
  medium: { label: 'Medium', cls: 'text-gray-700 bg-white ring-gray-300' },
  low:    { label: 'Low',    cls: 'text-gray-500 bg-white ring-gray-200' },
}

export function TaskStatusBadge({ status }: { status: string }) {
  const m = statusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />{m.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const m = PRIORITY_META[priority ?? 'medium'] ?? PRIORITY_META.medium
  return (
    <span className={`inline-flex whitespace-nowrap px-1.5 py-px rounded text-[11px] font-medium ring-1 ring-inset ${m.cls}`}>
      {m.label}
    </span>
  )
}

export function OverdueBadge() {
  return (
    <span className="inline-flex whitespace-nowrap px-1.5 py-px rounded text-[11px] font-medium text-red-700 bg-red-50 ring-1 ring-inset ring-red-200">
      Overdue
    </span>
  )
}

// ── Dates (ISO YYYY-MM-DD strings, compared as text) ─────────────────────────

/** Today's date in the given IANA timezone; falls back to the browser's zone */
export function todayIn(timeZone?: string): string {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export const isOpen = (t: Pick<Schedule, 'status'>) => t.status === 'pending' || t.status === 'in_progress'

/** Same rule as the backend dashboard alert: still open and dated before today */
export const isOverdue = (t: Pick<Schedule, 'status' | 'assigned_date'>, today: string) =>
  isOpen(t) && t.assigned_date < today

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-MY', { ...opts, timeZone: 'UTC' })
}

export const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : '')

/** Sort by date, then time (untimed last within a day), then id */
export const byDateTime = (a: Schedule, b: Schedule) =>
  a.assigned_date.localeCompare(b.assigned_date)
  || (a.scheduled_time ?? '99').localeCompare(b.scheduled_time ?? '99')
  || a.id - b.id

// ── Filtering ────────────────────────────────────────────────────────────────

export interface TaskFilters {
  status: 'all' | TaskStatus
  category: string
  worker: string
  from: string
  to: string
}

/** Every filter is optional ('all' or empty) and they combine with AND */
export const matchesFilters = (t: Schedule, f: TaskFilters, withDates = true) =>
  (f.status === 'all' || t.status === f.status)
  && (f.category === 'all' || t.task_type === f.category)
  && (f.worker === 'all' || String(t.worker_id) === f.worker)
  && (!withDates || ((!f.from || t.assigned_date >= f.from) && (!f.to || t.assigned_date <= f.to)))
