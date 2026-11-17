import React from 'react'
import {
  AlertTriangle, ArrowRightLeft, Ban, ClipboardCheck, History, Navigation, PackageCheck, Pencil, Recycle,
  RefreshCw, Scale, Sprout, Trash2, Truck, Unlink, XCircle,
} from 'lucide-react'

/** Display title, icon and colour for each batch event type recorded by the backend */
export const EVENT_INFO: Record<string, { title: string; icon: React.ElementType; tone: string }> = {
  harvest_created:          { title: 'Harvest Created',            icon: Sprout,         tone: 'bg-green-100 text-green-700' },
  quality_updated:          { title: 'Quality Inspection Updated', icon: ClipboardCheck, tone: 'bg-blue-100 text-blue-700' },
  grading_recorded:         { title: 'Grading Breakdown Recorded', icon: Scale,          tone: 'bg-green-100 text-green-700' },
  grading_updated:          { title: 'Grade Quantities Updated',   icon: Scale,          tone: 'bg-blue-100 text-blue-700' },
  status_changed:           { title: 'Grading Status Changed',     icon: ClipboardCheck, tone: 'bg-blue-100 text-blue-700' },
  spoilage_changed:         { title: 'Spoilage Updated',           icon: AlertTriangle,  tone: 'bg-orange-100 text-orange-700' },
  rejection_changed:        { title: 'Rejection Updated',          icon: XCircle,        tone: 'bg-red-100 text-red-700' },
  harvest_updated:          { title: 'Batch Details Updated',      icon: Pencil,         tone: 'bg-gray-100 text-gray-600' },
  transport_allocated:      { title: 'Transport Allocated',        icon: Truck,          tone: 'bg-amber-100 text-amber-700' },
  allocation_changed:       { title: 'Allocation Changed',         icon: ArrowRightLeft, tone: 'bg-amber-100 text-amber-700' },
  transport_unlinked:       { title: 'Transport Unlinked',         icon: Unlink,         tone: 'bg-gray-100 text-gray-600' },
  transport_dispatched:     { title: 'Transport Dispatched',       icon: Navigation,     tone: 'bg-blue-100 text-blue-700' },
  transport_delivered:      { title: 'Delivery Completed',         icon: PackageCheck,   tone: 'bg-emerald-100 text-emerald-700' },
  transport_cancelled:      { title: 'Transport Cancelled',        icon: Ban,            tone: 'bg-gray-100 text-gray-600' },
  transport_status_changed: { title: 'Transport Status Changed',   icon: RefreshCw,      tone: 'bg-blue-100 text-blue-700' },
  transport_removed:        { title: 'Transport Deleted',          icon: Trash2,         tone: 'bg-red-100 text-red-700' },
  waste_recorded:           { title: 'Waste Recorded',             icon: Recycle,        tone: 'bg-lime-100 text-lime-700' },
  waste_updated:            { title: 'Waste Record Updated',       icon: Recycle,        tone: 'bg-lime-100 text-lime-700' },
  waste_unlinked:           { title: 'Waste Unlinked',             icon: Unlink,         tone: 'bg-gray-100 text-gray-600' },
  waste_removed:            { title: 'Waste Record Removed',       icon: Trash2,         tone: 'bg-red-100 text-red-700' },
}

export const eventInfo = (type: string) =>
  EVENT_INFO[type] ?? { title: type.replace(/_/g, ' '), icon: History, tone: 'bg-gray-100 text-gray-600' }

