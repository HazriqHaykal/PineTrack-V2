import React from 'react'

/**
 * Shared building blocks for the worker (farmer) pages, so every page uses the
 * same card, spacing, form and button styles as the admin side: rounded-xl
 * cards with a light border, green-700 primary actions, 1.75 icon strokes.
 */

export const ICON_STROKE = 1.75

/** Form controls: 44 px+ tall for comfortable tapping */
export const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500'
export const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5'

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white ' +
  'hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2'
export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 ' +
  'hover:bg-gray-50 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600'

export const cardCls = 'bg-white rounded-xl border border-gray-200 shadow-sm'

/** Page shell: title row and a width that suits phones and tablets */
export function WorkerPage({ title, subtitle, actions, children, narrow }: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /** Forms read better a little narrower on tablets */
  narrow?: boolean
}) {
  return (
    <div className={`mx-auto w-full ${narrow ? 'max-w-xl' : 'max-w-3xl'} px-4 sm:px-6 py-5 sm:py-6 space-y-5`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

/** A titled white card section */
export function Section({ title, description, children, className = '' }: {
  title?: string; description?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={`${cardCls} p-4 sm:p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      <div className={title || description ? 'mt-4 space-y-4' : 'space-y-4'}>{children}</div>
    </section>
  )
}

/**
 * Summary number. The dot carries the semantic status colour; the tile itself
 * stays white so pages are not overloaded with colour. Pass onClick to make
 * it a filter toggle.
 */
export function StatTile({ label, value, sub, dot, alert, active, onClick }: {
  label: string
  value: React.ReactNode
  sub?: string
  dot?: string
  alert?: boolean
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <p className="flex items-start gap-1.5 text-xs font-medium leading-tight text-gray-600">
        {dot && <span className={`mt-[3px] h-2 w-2 rounded-full shrink-0 ${dot}`} aria-hidden />}
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 truncate">{sub}</p>}
    </>
  )
  const base = `rounded-xl border px-3 py-3 sm:px-3.5 text-left min-w-0 ${
    active ? 'border-green-700 bg-green-50 ring-1 ring-green-700' : alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
  }`
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`${base} transition-colors hover:border-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType; title: string; body?: string; action?: React.ReactNode
}) {
  return (
    <div className={`${cardCls} px-6 py-10 text-center`}>
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon size={20} strokeWidth={ICON_STROKE} />
      </span>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {body && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{children}</p>
}

/** Small heading above a list */
export function ListHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h2 className="text-sm font-semibold text-gray-900">{children}</h2>
      {action}
    </div>
  )
}

/** Segmented control used for tabs and view toggles */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; count?: number }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-1 gap-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}>
          {o.label}
          {o.count != null && (
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${value === o.value ? 'bg-green-50 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
