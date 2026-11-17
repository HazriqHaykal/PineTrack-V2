import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Schedule } from '../../types'
import { TASK_STATUS_META, TaskStatus, byDateTime, formatTime, isOverdue, taskLabel } from './taskMeta'

import { tr, locale } from '../../i18n'
const WEEKDAYS = [tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat"), tr("Sun")]

/** "YYYY-MM" → the Monday-first grid of ISO dates covering that month */
export function monthGrid(month: string): { iso: string; inMonth: boolean }[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7 // days before the 1st, Monday-first
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i))
    return { iso: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === m - 1 }
  })
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

const monthTitle = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default function MonthCalendar({ tasks, today, month, onMonthChange, selected, onSelect, onOpenTask, compact }: {
  tasks: Schedule[]
  today: string
  month: string
  onMonthChange: (month: string) => void
  selected: string
  onSelect: (iso: string) => void
  onOpenTask?: (task: Schedule) => void
  /** Dots only, for narrow layouts */
  compact?: boolean
}) {
  const byDay = useMemo(() => {
    const map: Record<string, Schedule[]> = {}
    for (const t of tasks) (map[t.assigned_date] ??= []).push(t)
    Object.values(map).forEach((list) => list.sort(byDateTime))
    return map
  }, [tasks])
  const cells = useMemo(() => monthGrid(month), [month])

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900" aria-live="polite">{monthTitle(month)}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => { onMonthChange(today.slice(0, 7)); onSelect(today) }}
            className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tr("Today")}
          </button>
          <button onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label={tr("Previous month")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label={tr("Next month")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-gray-200 rounded-lg overflow-hidden" role="grid">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="border-r border-b border-gray-200 bg-gray-50 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {compact ? d[0] : d}
          </div>
        ))}
        {cells.map(({ iso, inMonth }) => {
          const list = byDay[iso] ?? []
          const isToday = iso === today
          const isSelected = iso === selected
          const overdue = list.some((t) => isOverdue(t, today))
          const shown = compact ? [] : list.slice(0, 2)
          return (
            <div
              key={iso}
              role="gridcell"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelect(iso)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(iso) } }}
              aria-label={tr("{0}, {1} task{2}{3}", iso, list.length, list.length === 1 ? '' : 's', overdue ? ', some overdue' : '')}
              className={`relative border-r border-b border-gray-200 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 ${
                compact ? 'min-h-[52px] p-1' : 'min-h-[92px] p-1.5'
              } ${isSelected ? 'bg-green-50' : inMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/70 hover:bg-gray-100/70'}`}
            >
              <span className={`inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full text-xs tabular-nums ${
                isToday ? 'bg-green-700 font-semibold text-white'
                : isSelected ? 'font-semibold text-green-900'
                : inMonth ? 'text-gray-800' : 'text-gray-400'
              }`}>
                {Number(iso.slice(8))}
              </span>

              {compact ? (
                list.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-0.5">
                    {list.slice(0, 3).map((t) => (
                      <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_META[t.status as TaskStatus]?.dot ?? 'bg-gray-400'}`} />
                    ))}
                    {list.length > 3 && <span className="text-[10px] leading-none text-gray-500">+{list.length - 3}</span>}
                  </div>
                )
              ) : (
                <div className="mt-1 space-y-0.5">
                  {shown.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(iso); onOpenTask?.(t) }}
                      title={`${taskLabel(t.task_type)}${t.worker_name ? ` · ${t.worker_name}` : ''}`}
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-gray-100 ${
                        t.status === 'completed' || t.status === 'cancelled' ? 'text-gray-500' : 'text-gray-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TASK_STATUS_META[t.status as TaskStatus]?.dot ?? 'bg-gray-400'}`} />
                      <span className={`truncate ${t.status === 'cancelled' ? 'line-through' : ''}`}>
                        {t.scheduled_time && <span className="tabular-nums text-gray-500">{formatTime(t.scheduled_time)} </span>}
                        {taskLabel(t.task_type)}
                      </span>
                    </button>
                  ))}
                  {list.length > shown.length && (
                    <p className="px-1 text-[11px] font-medium text-gray-500">+{list.length - shown.length} {tr("more")}</p>
                  )}
                </div>
              )}
              {overdue && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" title={tr("Has overdue tasks")} />}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TASK_STATUS_META[s].dot}`} />{TASK_STATUS_META[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{tr("Has overdue")}</span>
      </div>
    </div>
  )
}
