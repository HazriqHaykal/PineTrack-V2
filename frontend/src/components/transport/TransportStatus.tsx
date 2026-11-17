import { Ban, LucideIcon, Navigation, PackageCheck, RotateCcw } from 'lucide-react'
import GuidePopover from '../ui/GuidePopover'
import { Transport } from '../../types'

export type TransportStatus = Transport['status']

/** Backend enum values, in workflow order; labels are display-only */
export const TRANSPORT_STATUSES: TransportStatus[] = ['pending', 'in_transit', 'delivered', 'cancelled']

export const TRANSPORT_STATUS_META: Record<TransportStatus, { label: string; badge: string; dot: string; meaning: string }> = {
  pending:    { label: 'Scheduled',  badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', meaning: 'Booked and holding batch stock; not yet on the road.' },
  in_transit: { label: 'In Transit', badge: 'bg-blue-50 text-blue-800 ring-blue-200',    dot: 'bg-blue-500',  meaning: 'Dispatched and on the way to the destination.' },
  delivered:  { label: 'Delivered',  badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600', meaning: 'Arrived at the destination; counted as delivered on its batch.' },
  cancelled:  { label: 'Cancelled',  badge: 'bg-gray-100 text-gray-700 ring-gray-300',   dot: 'bg-red-500',   meaning: 'Called off. Its cargo no longer counts against the batch.' },
}

export const statusMeta = (s: string) => TRANSPORT_STATUS_META[s as TransportStatus] ?? TRANSPORT_STATUS_META.pending

/** Mirrors the backend: a delivered, batch-linked transport keeps its batch, weight and record */
export const isLockedDelivery = (t: Pick<Transport, 'status' | 'harvest_id'>) =>
  t.status === 'delivered' && t.harvest_id != null

export function TransportStatusBadge({ status }: { status: string }) {
  const m = statusMeta(status)
  return (
    <span
      title={m.meaning}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${m.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  )
}

export interface StatusAction {
  to: TransportStatus
  label: string
  icon: LucideIcon
  /** Classes for the compact pill used in tables and headers */
  pill: string
  confirmTitle: string
  confirmBody: string
  confirmLabel: string
  danger?: boolean
}

const DISPATCH: StatusAction = {
  to: 'in_transit', label: 'Dispatch', icon: Navigation,
  pill: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  confirmTitle: 'Dispatch this delivery?',
  confirmBody: 'The status changes to In Transit. Its cargo stays reserved on the linked batch until delivery.',
  confirmLabel: 'Dispatch',
}
const DELIVER: StatusAction = {
  to: 'delivered', label: 'Deliver', icon: PackageCheck,
  pill: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100',
  confirmTitle: 'Mark as delivered?',
  confirmBody: "Today's date is recorded as the delivery date. If the delivery is linked to a harvest batch, it becomes part of that batch's history: its batch and cargo weight are locked, and it can no longer be cancelled or deleted.",
  confirmLabel: 'Mark Delivered',
}
const CANCEL: StatusAction = {
  to: 'cancelled', label: 'Cancel delivery', icon: Ban,
  pill: 'border-gray-200 bg-white text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200',
  confirmTitle: 'Cancel this delivery?',
  confirmBody: 'The delivery is kept on record as Cancelled and its cargo is released back to the linked batch.',
  confirmLabel: 'Cancel Delivery',
  danger: true,
}
const REOPEN: StatusAction = {
  to: 'pending', label: 'Reopen', icon: RotateCcw,
  pill: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  confirmTitle: 'Reopen this delivery?',
  confirmBody: 'The delivery goes back to Scheduled. If it is linked to a batch, its cargo must fit within the stock still available, or the change is refused.',
  confirmLabel: 'Reopen',
}

/** The single forward step for the workflow Scheduled → In Transit → Delivered */
export const NEXT_ACTION: Record<TransportStatus, StatusAction | null> = {
  pending: DISPATCH,
  in_transit: DELIVER,
  delivered: null,
  cancelled: null,
}

/** Secondary transitions offered to admins only: cancelling an open delivery, or reopening a cancelled one */
export const SIDE_ACTIONS: Record<TransportStatus, StatusAction[]> = {
  pending: [CANCEL],
  in_transit: [CANCEL],
  delivered: [],
  cancelled: [REOPEN],
}

export function TransportStatusGuide() {
  return (
    <GuidePopover
      sections={[{
        heading: 'Transport status',
        items: TRANSPORT_STATUSES.map((s) => ({
          key: s, dot: TRANSPORT_STATUS_META[s].dot, label: TRANSPORT_STATUS_META[s].label, meaning: TRANSPORT_STATUS_META[s].meaning,
        })),
      }, {
        heading: 'Workflow',
        items: [
          { key: 'flow', dot: 'bg-gray-400', label: 'Order', meaning: 'Scheduled → In Transit → Delivered. Open deliveries can be cancelled.' },
        ],
      }]}
    />
  )
}
