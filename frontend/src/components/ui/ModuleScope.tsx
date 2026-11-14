import { useSearchParams } from 'react-router-dom'
import { AnalysisScope } from '../../types'

export const SCOPE_OPTIONS: { value: AnalysisScope; label: string }[] = [
  { value: 'all',          label: 'All Modules' },
  { value: 'sulur',        label: 'Sulur Inventory' },
  { value: 'post_harvest', label: 'Post-Harvest Management' },
]

export const scopeLabel = (s: AnalysisScope) => SCOPE_OPTIONS.find((o) => o.value === s)?.label ?? s

/**
 * The selected module scope, kept in the URL (?scope=) so refresh, links and
 * back/forward keep it. Other query parameters on the page are preserved.
 */
export function useModuleScope(): [AnalysisScope, (s: AnalysisScope) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('scope')
  const scope: AnalysisScope = SCOPE_OPTIONS.some((o) => o.value === raw) ? (raw as AnalysisScope) : 'all'
  const setScope = (s: AnalysisScope) => {
    const next = new URLSearchParams(params)
    if (s === 'all') next.delete('scope')
    else next.set('scope', s)
    setParams(next)
  }
  return [scope, setScope]
}

/** Segmented control; a radio group for keyboard and screen-reader users */
export function ModuleScopeSelect({ value, onChange, disabled }: {
  value: AnalysisScope
  onChange: (s: AnalysisScope) => void
  disabled?: boolean
}) {
  const move = (dir: 1 | -1) => {
    const i = SCOPE_OPTIONS.findIndex((o) => o.value === value)
    const next = SCOPE_OPTIONS[(i + dir + SCOPE_OPTIONS.length) % SCOPE_OPTIONS.length]
    onChange(next.value)
    requestAnimationFrame(() => document.getElementById(`scope-opt-${next.value}`)?.focus())
  }
  return (
    <div
      role="radiogroup"
      aria-label="Module scope"
      className="inline-flex max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      }}
    >
      {SCOPE_OPTIONS.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            id={`scope-opt-${o.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 disabled:opacity-60 ${
              selected ? 'bg-[#162f25] text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
