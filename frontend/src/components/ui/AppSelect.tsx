import React, { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

import { tr } from '../../i18n'
/**
 * PineTrack's select. Built on Radix Select, which provides the listbox
 * semantics, keyboard support (arrows, Home/End, type-ahead, Enter/Space,
 * Escape), focus management, a portal (no clipping by scroll containers or
 * modals) and collision-aware positioning that flips the menu upward when
 * there is no room below.
 *
 * Values are passed through untouched, so backend enum values stay what they
 * are; only `label` is shown. Radix reserves the empty string, so an option
 * with value "" (e.g. "No batch linked") is mapped to an internal token and
 * back again.
 */

export interface AppSelectOption {
  value: string
  label: React.ReactNode
  /** Second line under the label */
  description?: React.ReactNode
  disabled?: boolean
  /** Plain text for type-ahead when `label` is not a string */
  textValue?: string
}

export interface AppSelectGroup {
  label: string
  options: AppSelectOption[]
}

export interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options?: AppSelectOption[]
  groups?: AppSelectGroup[]
  id?: string
  name?: string
  /** Rendered above the trigger when given; otherwise pair with an existing <label htmlFor={id}> */
  label?: React.ReactNode
  helperText?: React.ReactNode
  /** Message (shown and announced) or true for the red state only */
  error?: React.ReactNode | boolean
  placeholder?: string
  disabled?: boolean
  required?: boolean
  loading?: boolean
  emptyText?: string
  /** 'md' for forms (44 px), 'sm' for toolbar filters (36 px) */
  size?: 'md' | 'sm'
  /** Filters: green border when a non-default value is chosen */
  highlighted?: boolean
  className?: string
  triggerClassName?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

const EMPTY = '__pt_empty__'
const toRadix = (v: string) => (v === '' ? EMPTY : v)
const fromRadix = (v: string) => (v === EMPTY ? '' : v)

/** Height of the worker app's fixed bottom tab bar, if it is on screen, so menus avoid it */
function bottomObstruction(): number {
  const nav = document.querySelector<HTMLElement>('[data-bottom-nav]')
  // offsetParent is always null for position: fixed, so check for rendered boxes instead
  if (!nav || nav.getClientRects().length === 0) return 0
  const r = nav.getBoundingClientRect()
  return Math.max(0, Math.ceil(window.innerHeight - r.top))
}

export const selectTriggerCls = (size: 'md' | 'sm', invalid: boolean, highlighted = false) =>
  [
    'group inline-flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-left text-gray-900',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:border-transparent',
    'data-[state=open]:ring-2 data-[state=open]:ring-green-600 data-[state=open]:border-transparent',
    'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 transition-colors',
    'data-[placeholder]:text-gray-400',
    size === 'sm' ? 'h-9 px-3 text-sm' : 'min-h-[44px] px-3.5 py-2 text-sm',
    invalid ? 'border-red-400' : highlighted ? 'border-green-600' : 'border-gray-200 hover:border-gray-300',
  ].join(' ')

export const selectContentCls =
  'app-select-content z-[80] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ' +
  'min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-16px)] ' +
  'max-h-[min(var(--radix-select-content-available-height),22rem)]'

export const optionCls =
  'relative flex min-h-[44px] w-full cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-3 pr-9 text-sm text-gray-900 outline-none ' +
  'data-[highlighted]:bg-green-50 data-[highlighted]:text-green-900 data-[state=checked]:font-medium ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400'

export default function AppSelect({
  value, onChange, options, groups, id, name, label, helperText, error, placeholder = 'Select…',
  disabled, required, loading, emptyText = tr("No options available"), size = 'md', highlighted,
  className = '', triggerClassName = '', ...aria
}: AppSelectProps) {
  const [padBottom, setPadBottom] = useState(8)
  const invalid = !!error
  const errorText = typeof error === 'string' || React.isValidElement(error) ? error : null
  const helpId = id ? `${id}-help` : undefined
  const errId = id ? `${id}-error` : undefined
  const describedBy = [aria['aria-describedby'], errorText ? errId : null, helperText && !errorText ? helpId : null]
    .filter(Boolean).join(' ') || undefined

  const allGroups: AppSelectGroup[] = groups ?? (options ? [{ label: '', options }] : [])
  const empty = allGroups.every((g) => g.options.length === 0)

  const renderOption = (o: AppSelectOption) => (
    <Select.Item key={o.value || EMPTY} value={toRadix(o.value)} disabled={o.disabled}
      textValue={o.textValue ?? (typeof o.label === 'string' ? o.label : undefined)} className={optionCls}>
      <span className="min-w-0">
        <Select.ItemText>{o.label}</Select.ItemText>
        {o.description && <span className="block text-xs font-normal text-gray-500">{o.description}</span>}
      </span>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center text-green-700">
        <Check size={16} strokeWidth={2.25} />
      </Select.ItemIndicator>
    </Select.Item>
  )

  const control = (
    <Select.Root
      value={toRadix(value)}
      onValueChange={(v) => onChange(fromRadix(v))}
      onOpenChange={(open) => { if (open) setPadBottom(8 + bottomObstruction()) }}
      disabled={disabled || loading}
      required={required}
      name={name}
    >
      <Select.Trigger id={id} aria-label={aria['aria-label']} aria-describedby={describedBy}
        aria-invalid={invalid || undefined} className={`${selectTriggerCls(size, invalid, highlighted)} ${triggerClassName}`}>
        <span className="min-w-0 flex-1 truncate">
          {loading ? <span className="inline-flex items-center gap-2 text-gray-500"><Loader2 size={14} className="animate-spin" /> {tr("Loading…")}</span>
            : <Select.Value placeholder={placeholder} />}
        </span>
        <Select.Icon className="shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180">
          <ChevronDown size={16} strokeWidth={1.75} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={{ top: 8, left: 8, right: 8, bottom: padBottom }}
          className={selectContentCls}>
          <Select.ScrollUpButton className="flex h-7 items-center justify-center text-gray-500">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>
          <Select.Viewport className="p-1">
            {empty ? (
              <p className="px-3 py-3 text-sm text-gray-500">{emptyText}</p>
            ) : allGroups.map((g, i) => (
              g.label ? (
                <Select.Group key={g.label}>
                  {i > 0 && <Select.Separator className="my-1 h-px bg-gray-100" />}
                  <Select.Label className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.label}</Select.Label>
                  {g.options.map(renderOption)}
                </Select.Group>
              ) : <React.Fragment key={i}>{g.options.map(renderOption)}</React.Fragment>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-7 items-center justify-center text-gray-500">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )

  if (!label && !helperText && !errorText) {
    return className ? <div className={className}>{control}</div> : control
  }
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-gray-700">
          {label}{required && <span className="text-red-600"> *</span>}
        </label>
      )}
      {control}
      {errorText ? (
        <p id={errId} role="alert" className="mt-1 text-xs text-red-700">{errorText}</p>
      ) : helperText ? (
        <p id={helpId} className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  )
}
