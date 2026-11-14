import React from 'react'
import { CheckCircle2, Pencil, PlayCircle, Trash2 } from 'lucide-react'
import { Dialog, btnPrimary, btnSecondary } from '../ui/Dialog'
import { Schedule } from '../../types'
import {
  OverdueBadge, PriorityBadge, TaskStatusBadge, formatDay, formatTime, isOverdue, taskLabel,
} from './taskMeta'

const fmtStamp = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

/**
 * Read-only view of one task, with only the actions the current user can take.
 * Admins get edit/delete; the assigned worker gets start/complete.
 */
export default function TaskDetailsDialog({ task, today, onClose, admin, worker, busy }: {
  task: Schedule | null
  today: string
  onClose: () => void
  admin?: { onEdit: (t: Schedule) => void; onDelete: (t: Schedule) => void }
  worker?: { onStart: (t: Schedule) => void; onComplete: (t: Schedule) => void }
  busy?: boolean
}) {
  if (!task) return null
  const overdue = isOverdue(task, today)
  const open = task.status === 'pending' || task.status === 'in_progress'

  const facts: [string, React.ReactNode][] = [
    ['Assigned worker', task.worker_name || `Worker #${task.worker_id}`],
    ['Scheduled', <>{formatDay(task.assigned_date)}{task.scheduled_time && <span className="tabular-nums"> · {formatTime(task.scheduled_time)}</span>}</>],
    ['Priority', <PriorityBadge priority={task.priority} />],
    ['Status', <span className="inline-flex flex-wrap items-center gap-1.5"><TaskStatusBadge status={task.status} />{overdue && <OverdueBadge />}</span>],
    ['Created', fmtStamp(task.created_at)],
    ['Last updated', fmtStamp(task.updated_at)],
  ]

  let footer: React.ReactNode = <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
  if (admin) {
    footer = (
      <>
        <button type="button" onClick={() => admin.onDelete(task)}
          className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50">
          <Trash2 size={15} strokeWidth={1.75} /> Delete
        </button>
        <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
        <button type="button" onClick={() => admin.onEdit(task)} className={`${btnPrimary} inline-flex items-center gap-1.5`}>
          <Pencil size={15} strokeWidth={1.75} /> Edit
        </button>
      </>
    )
  } else if (worker && open) {
    footer = (
      <>
        {task.status === 'pending' && (
          <button type="button" disabled={busy} onClick={() => worker.onStart(task)} className={`${btnSecondary} inline-flex items-center gap-1.5`}>
            <PlayCircle size={15} strokeWidth={1.75} /> Start Task
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => worker.onComplete(task)} className={`${btnPrimary} inline-flex items-center gap-1.5`}>
          <CheckCircle2 size={15} strokeWidth={1.75} /> {busy ? 'Saving…' : 'Mark as Completed'}
        </button>
      </>
    )
  }

  return (
    <Dialog open title={taskLabel(task.task_type)} subtitle={`Task #${task.id}`} onClose={onClose} footer={footer}>
      <div className="space-y-5">
        <div>
          <p className="text-xs text-gray-500">Description</p>
          {task.details
            ? <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap break-words">{task.details}</p>
            : <p className="mt-1 text-sm text-gray-500">No description.</p>}
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {facts.map(([name, value]) => (
            <div key={name} className="min-w-0">
              <dt className="text-xs text-gray-500">{name}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 space-y-1">
          {task.status === 'completed' && (
            <p>Marked completed. The exact completion time and completion notes are not stored; “Last updated” is the latest change to this task.</p>
          )}
          <p>Tasks are not linked to specific harvest batches or transports.</p>
        </div>
      </div>
    </Dialog>
  )
}
