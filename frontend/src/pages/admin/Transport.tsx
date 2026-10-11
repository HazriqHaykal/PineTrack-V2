import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Truck, Clock, CheckCircle2, Search, XCircle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Transport, SystemUser, Harvest } from '../../types'

const STATUS_STYLES: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  pending:    { badge: 'bg-amber-100 text-amber-800',  icon: Clock,         label: 'Pending'    },
  in_transit: { badge: 'bg-blue-100  text-blue-800',   icon: Truck,         label: 'In Transit' },
  delivered:  { badge: 'bg-green-100 text-green-800',  icon: CheckCircle2,  label: 'Delivered'  },
  cancelled:  { badge: 'bg-gray-100  text-gray-600',   icon: XCircle,       label: 'Cancelled'  },
}

const EMPTY_FORM = {
  destination:       '',
  driver_name:       '',
  vehicle_number:    '',
  scheduled_date:    new Date().toISOString().split('T')[0],
  status:            'pending',
  cargo_weight_kg:   '',
  notes:             '',
  driver_id:         '',
  harvest_id:        '',
}

function Modal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>{msg}</div>
  )
}

export default function TransportPage() {
  const [transports, setTransports] = useState<Transport[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [modalOpen, setModal]       = useState(false)
  const [delConfirm, setDel]        = useState<number | null>(null)
  const [editing, setEditing]       = useState<Transport | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [submitting, setSub]        = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [workers, setWorkers]       = useState<SystemUser[]>([])
  const [harvests, setHarvests]     = useState<Harvest[]>([])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    try {
      const d = await apiClient.listTransports()
      setTransports(d.items || [])
    } catch (err) {
      setTransports([])
      showToast(apiErrorMessage(err, 'Failed to load transports'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    apiClient.listUsers().then(d => setWorkers(d.items.filter(u => u.is_active))).catch(() => setWorkers([]))
    apiClient.listHarvests(0, 500).then(d => setHarvests(d.items)).catch(() => setHarvests([]))
  }, [])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModal(true) }
  const openEdit   = (t: Transport) => {
    setEditing(t)
    setForm({
      destination:     t.destination,
      driver_name:     t.driver_name,
      vehicle_number:  t.vehicle_number,
      scheduled_date:  t.scheduled_date,
      status:          t.status,
      cargo_weight_kg: t.cargo_weight_kg ? String(t.cargo_weight_kg) : '',
      notes:           t.notes || '',
      driver_id:       t.driver_id ? String(t.driver_id) : '',
      harvest_id:      t.harvest_id ? String(t.harvest_id) : '',
    })
    setModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSub(true)
    try {
      const payload = {
        ...form,
        cargo_weight_kg: form.cargo_weight_kg ? parseFloat(form.cargo_weight_kg) : undefined,
        driver_id: form.driver_id ? parseInt(form.driver_id) : null,
        harvest_id: form.harvest_id ? parseInt(form.harvest_id) : null,
      } as any
      if (editing) {
        await apiClient.updateTransport(editing.id, payload)
        showToast('Transport updated', 'success')
      } else {
        await apiClient.createTransport(payload)
        showToast('Transport created', 'success')
      }
      setModal(false)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to save transport'), 'error')
    } finally {
      setSub(false)
    }
  }

  const quickStatus = async (id: number, status: Transport['status']) => {
    try {
      await apiClient.updateTransport(id, { status })
      showToast('Status updated', 'success')
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Update failed'), 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteTransport(id)
      showToast('Transport deleted', 'success')
      setDel(null)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Delete failed'), 'error')
    }
  }

  const filtered = transports.filter((t) => {
    const matchSearch = t.destination.toLowerCase().includes(search.toLowerCase()) ||
                        t.driver_name.toLowerCase().includes(search.toLowerCase()) ||
                        t.vehicle_number.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    total:      transports.length,
    pending:    transports.filter(t => t.status === 'pending').length,
    in_transit: transports.filter(t => t.status === 'in_transit').length,
    delivered:  transports.filter(t => t.status === 'delivered').length,
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transport Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Schedule and track pineapple deliveries</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Transport
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total',      value: counts.total,      color: 'text-gray-900'  },
            { label: 'Pending',    value: counts.pending,    color: 'text-amber-600' },
            { label: 'In Transit', value: counts.in_transit, color: 'text-blue-600'  },
            { label: 'Delivered',  value: counts.delivered,  color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search destination, driver…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            {['All', 'pending', 'in_transit', 'delivered', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {STATUS_STYLES[s]?.label || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Truck size={36} className="mb-2 opacity-30" />
              <p className="font-medium">No transports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Batch', 'Destination', 'Driver', 'Vehicle', 'Scheduled', 'Weight (kg)', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const s = STATUS_STYLES[t.status] || STATUS_STYLES.pending
                    const Icon = s.icon
                    return (
                      <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{t.batch_number || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{t.destination}</td>
                        <td className="px-4 py-3 text-gray-600">{t.driver_name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{t.vehicle_number}</td>
                        <td className="px-4 py-3 text-gray-600">{t.scheduled_date}</td>
                        <td className="px-4 py-3 text-gray-600">{t.cargo_weight_kg?.toLocaleString() ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
                            <Icon size={11} /> {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {t.status === 'pending' && (
                              <button onClick={() => quickStatus(t.id, 'in_transit')}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors">
                                Dispatch
                              </button>
                            )}
                            {t.status === 'in_transit' && (
                              <button onClick={() => quickStatus(t.id, 'delivered')}
                                className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors">
                                Deliver
                              </button>
                            )}
                            <button onClick={() => openEdit(t)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDel(t.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} title={editing ? 'Edit Transport' : 'New Transport'} onClose={() => setModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Destination *</label>
              <input type="text" value={form.destination} onChange={(e) => setForm({...form, destination: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Kuala Lumpur Market" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Driver Name *</label>
              <input type="text" value={form.driver_name} onChange={(e) => setForm({...form, driver_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Driver full name" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Vehicle No. *</label>
              <input type="text" value={form.vehicle_number} onChange={(e) => setForm({...form, vehicle_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. WXY 1234" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Harvest Batch</label>
              <select
                value={form.harvest_id}
                onChange={(e) => {
                  const batch = harvests.find(h => String(h.id) === e.target.value)
                  // Suggest the batch's marketable weight as the cargo weight when none was typed
                  setForm({
                    ...form,
                    harvest_id: e.target.value,
                    cargo_weight_kg: form.cargo_weight_kg || (batch ? String(batch.marketable_yield_kg) : ''),
                  })
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No batch linked</option>
                {harvests.map(h => (
                  <option key={h.id} value={h.id}>{h.batch_number} · {h.field_name} · {h.quantity_kg} kg</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Assign to Worker</label>
              <select
                value={form.driver_id}
                onChange={(e) => {
                  const worker = workers.find(w => String(w.id) === e.target.value)
                  // Pre-fill the driver name from the chosen account; it stays editable
                  setForm({ ...form, driver_id: e.target.value, driver_name: worker ? (worker.full_name || worker.username) : form.driver_name })
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Not assigned (external driver)</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name || w.username} ({w.role})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">The assigned worker sees this delivery in their app and can update its status.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Scheduled Date *</label>
              <input type="date" value={form.scheduled_date} onChange={(e) => setForm({...form, scheduled_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Cargo Weight (kg)</label>
              <input type="number" value={form.cargo_weight_kg} onChange={(e) => setForm({...form, cargo_weight_kg: e.target.value})}
                min="0" step="0.1" placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(STATUS_STYLES).map(([v, s]) => (
                  <option key={v} value={v}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}
                rows={3} placeholder="Optional notes…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving…' : editing ? 'Update' : 'Create Transport'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={delConfirm !== null} title="Confirm Delete" onClose={() => setDel(null)}>
        <p className="text-sm text-gray-600 mb-6">Delete this transport record permanently?</p>
        <div className="flex gap-3">
          <button onClick={() => setDel(null)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => delConfirm !== null && handleDelete(delConfirm)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Delete</button>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  )
}

