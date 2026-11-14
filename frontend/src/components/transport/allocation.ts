import { BatchSummary, Harvest, Transport } from '../../types'
import { isLockedDelivery } from './TransportStatus'

/**
 * Transport form model and the client-side mirror of the backend's batch
 * allocation rules (BatchService.check_allocation / TransportService._check_batch_rules).
 * The server re-checks everything under a row lock; this only gives early, clear feedback.
 */

export const today = () => new Date().toISOString().split('T')[0]

export const EMPTY_FORM = {
  destination:     '',
  harvest_id:      '',
  cargo_weight_kg: '',
  scheduled_date:  today(),
  driver_id:       '',
  driver_name:     '',
  vehicle_number:  '',
  notes:           '',
}
export type FormState = typeof EMPTY_FORM
export type FormErrors = Partial<Record<keyof FormState, string>>

export const fmtKg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
const round2 = (n: number) => Math.round(n * 100) / 100

/** What the selected batch can supply to this transport, mirroring the backend allocation rules */
export interface Allocation {
  batch: Harvest | undefined
  summary: BatchSummary | undefined
  /** Cargo this transport already holds on the same batch (added back when editing) */
  ownShare: number
  /** Most this transport may carry from the batch, or undefined when unknown */
  maxKg: number | undefined
  rejected: boolean
}

export function allocationFor(
  form: FormState, editing: Transport | null, harvests: Harvest[], summaries: Record<number, BatchSummary>,
): Allocation | null {
  if (!form.harvest_id) return null
  const id = Number(form.harvest_id)
  const batch = harvests.find((h) => h.id === id)
  const summary = summaries[id]
  // The backend leaves out the edited transport's own reservation when checking stock
  const sameClaim = !!editing && editing.harvest_id === id && editing.status !== 'cancelled'
  const ownShare = sameClaim ? editing!.cargo_weight_kg ?? 0 : 0
  const maxKg = summary ? round2(Math.max(summary.available_kg, 0) + ownShare) : undefined
  return { batch, summary, ownShare, maxKg, rejected: batch?.harvest_status === 'rejected' }
}

export function validate(form: FormState, editing: Transport | null, alloc: Allocation | null): FormErrors {
  const e: FormErrors = {}
  if (!form.destination.trim()) e.destination = 'Enter where the cargo is going.'
  if (!form.scheduled_date) e.scheduled_date = 'Choose the planned delivery date.'
  if (!form.driver_name.trim()) e.driver_name = 'Enter the driver’s name.'
  if (!form.vehicle_number.trim()) e.vehicle_number = 'Enter the vehicle plate number.'

  const raw = form.cargo_weight_kg.trim()
  const weight = raw ? Number(raw) : null
  if (raw && (!Number.isFinite(weight) || (weight as number) <= 0)) {
    e.cargo_weight_kg = 'Cargo weight must be a number greater than 0.'
    return e
  }
  if (!alloc || (editing && isLockedDelivery(editing))) return e

  // Same rules as the backend: keeping or lowering this transport's own claim is always allowed
  if (alloc.ownShare > 0 && weight !== null && weight <= alloc.ownShare) return e
  if (editing && alloc.ownShare === 0 && editing.harvest_id === Number(form.harvest_id)
      && editing.status !== 'cancelled' && weight === null && editing.cargo_weight_kg == null) return e

  if (alloc.rejected) {
    e.harvest_id = 'This batch was rejected at grading and cannot be allocated to a transport.'
  } else if (weight === null) {
    e.cargo_weight_kg = 'Cargo weight is required when a harvest batch is linked.'
  } else if (alloc.maxKg !== undefined && weight > alloc.maxKg + 0.005) {
    e.cargo_weight_kg = alloc.maxKg > 0
      ? `Only ${fmtKg(alloc.maxKg)} is available from this batch.`
      : 'This batch has no stock left to allocate.'
  }
  return e
}

