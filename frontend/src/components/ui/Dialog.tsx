import React, { useEffect } from 'react'
import { X } from 'lucide-react'

import { tr } from '../../i18n'
/**
 * Modal shell whose header and footer stay put while the body scrolls.
 * Pass `as="form"` with `onSubmit` to make the body + footer a single form.
 */
export function Dialog({ open, title, subtitle, onClose, footer, children, size = 'md', onSubmit }: {
  open: boolean
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  onSubmit?: (e: React.FormEvent) => void
}) {
  useEffect(() => {
    if (!open) return
    // A dropdown open inside the dialog handles Escape first (and marks it handled); only then close the dialog
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  const Body = onSubmit ? 'form' : 'div'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-white rounded-2xl shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <div className="mt-0.5 text-sm text-gray-600">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={tr("Close")}
            className="p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <Body onSubmit={onSubmit} noValidate={onSubmit ? true : undefined} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-5 flex-1 min-h-0">{children}</div>
          {footer && (
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl shrink-0">
              {footer}
            </div>
          )}
        </Body>
      </div>
    </div>
  )
}

export const btnSecondary =
  'px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60'
export const btnPrimary =
  'px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60'
export const btnDanger =
  'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60'

export function ConfirmDialog({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }: {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className={btnSecondary}>{tr("Go back")}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={danger ? btnDanger : btnPrimary}>
            {busy ? tr("Working…") : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-gray-700 leading-relaxed">{body}</div>
    </Dialog>
  )
}
