import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { selectTriggerCls } from './AppSelect'

/**
 * Select with a search box, for long lists such as harvest batches.
 *
 * Radix Popover provides the portal, collision-aware positioning (flips up
 * when needed), outside-click and Escape dismissal and focus return. The list
 * follows the ARIA combobox pattern: the search input has role="combobox" and
 * points at the active option with aria-activedescendant; options are
 * role="option" in a role="listbox". Arrow keys, Home/End, Enter and Escape work.
 */

export interface SearchableOption {
  value: string
  label: string
  description?: React.ReactNode
  /** Extra text matched by the search (e.g. field name) */
  keywords?: string
  disabled?: boolean
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  /** Adds a first option with value "" (e.g. "No batch linked") */
  emptyOptionLabel?: string
  disabled?: boolean
  loading?: boolean
  error?: boolean
  noResultsText?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

function bottomObstruction(): number {
  const nav = document.querySelector<HTMLElement>('[data-bottom-nav]')
  // offsetParent is always null for position: fixed, so check for rendered boxes instead
  if (!nav || nav.getClientRects().length === 0) return 0
  const r = nav.getBoundingClientRect()
  return Math.max(0, Math.ceil(window.innerHeight - r.top))
}

export default function SearchableSelect({
  value, onChange, options, id, placeholder = 'Select…', searchPlaceholder = 'Search…', emptyOptionLabel,
  disabled, loading, error, noResultsText = 'No matches', ...aria
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [padBottom, setPadBottom] = useState(8)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  const all = useMemo<SearchableOption[]>(
    () => (emptyOptionLabel ? [{ value: '', label: emptyOptionLabel }, ...options] : options),
    [options, emptyOptionLabel],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q))
  }, [all, query])
  const selected = all.find((o) => o.value === value)

  // Start on the selected option when opening; reset to the top while typing
  useEffect(() => {
    if (open) {
      const i = filtered.findIndex((o) => o.value === value)
      setActive(i >= 0 ? i : 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (o: SearchableOption) => {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
  }

  const move = (delta: number) => {
    if (!filtered.length) return
    let i = active
    for (let n = 0; n < filtered.length; n++) {
      i = (i + delta + filtered.length) % filtered.length
      if (!filtered[i].disabled) break
    }
    setActive(i)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]) }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <Popover.Root open={open} onOpenChange={(o) => {
      if (o) setPadBottom(8 + bottomObstruction())
      else setQuery('')
      setOpen(o)
    }}>
      <Popover.Trigger asChild disabled={disabled || loading}>
        <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open}
          aria-label={aria['aria-label']} aria-describedby={aria['aria-describedby']} aria-invalid={error || undefined}
          data-state={open ? 'open' : 'closed'}
          className={selectTriggerCls('md', !!error)}>
          <span className={`min-w-0 flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
            {loading
              ? <span className="inline-flex items-center gap-2 text-gray-500"><Loader2 size={14} className="animate-spin" /> Loading…</span>
              : selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={{ top: 8, left: 8, right: 8, bottom: padBottom }}
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus() }}
          className="app-select-content z-[80] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg
            w-[max(var(--radix-popover-trigger-width),16rem)] max-w-[calc(100vw-16px)]
            max-h-[min(var(--radix-popover-content-available-height),24rem)]">
          <div className="relative border-b border-gray-100 p-2">
            <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={filtered[active] ? optionId(active) : undefined}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={aria['aria-label'] ?? placeholder}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500" role="presentation">{noResultsText}</li>
            ) : filtered.map((o, i) => {
              const isSelected = o.value === value
              return (
                <li key={o.value || '__empty'} id={optionId(i)} data-index={i} role="option"
                  aria-selected={isSelected} aria-disabled={o.disabled || undefined}
                  onMouseMove={() => !o.disabled && setActive(i)}
                  onClick={() => choose(o)}
                  className={`relative flex min-h-[44px] cursor-pointer select-none flex-col justify-center rounded-lg py-2 pl-3 pr-9 text-sm ${
                    o.disabled ? 'cursor-not-allowed text-gray-400'
                      : i === active ? 'bg-green-50 text-green-900' : 'text-gray-900'
                  } ${isSelected ? 'font-medium' : ''} ${o.value === '' ? 'text-gray-600' : ''}`}>
                  <span className="truncate">{o.label}</span>
                  {o.description && <span className="truncate text-xs font-normal text-gray-500">{o.description}</span>}
                  {isSelected && <Check size={16} strokeWidth={2.25} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-700" aria-hidden />}
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
