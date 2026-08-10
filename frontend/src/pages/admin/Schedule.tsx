import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Calendar, Search, Sprout, Truck, Eye, Wrench, FileText } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient } from '../../services/api'
import { Schedule } from '../../types'

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-amber-100  text-amber-800',
  in_progress: 'bg-blue-100   text-blue-800',
  completed:   'bg-green-100  text-green-800',
  cancelled:   'bg-gray-100   text-gray-600',
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-gray-100   text-gray-600',
  medium: 'bg-amber-100  text-amber-800',
  high:   'bg-red-100    text-red-800',
}

const TASK_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  harvest:     { icon: Sprout,   color: 'text-green-600 bg-green-50'  },
  transport:   { icon: Truck,    color: 'text-blue-600 bg-blue-50'    },
  inspection:  { icon: Eye,      color: 'text-purple-600 bg-purple-50'},
  maintenance: { icon: Wrench,   color: 'text-amber-600 bg-amber-50'  },
  other:       { icon: FileText, color: 'text-gray-600 bg-gray-100'   },
}

const EMPTY_FORM = {
  task_type:     'harvest',
  assigned_date: new Date().toISOString().split('T')[0],
  status:        'pending',
  priority:      'medium',
  details:       '',
  worker_id:     1,
}

function Modal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
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

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('All')
  const [modalOpen, setModal]     = useState(false)
  const [delConfirm, setDel]      = useState<number | null>(null)
  const [editing, setEditing]     = useState<Schedule | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [submitting, setSub]      = useState(false)
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const DEMO_SCHEDULES: Schedule[] = [
    { id: 1, worker_id: 2, task_type: 'harvest',     assigned_date: '2026-05-23', status: 'pending',     priority: 'high',   details: 'Harvest Block A-3 — estimated 200 kg', created_at: '2026-05-21T08:00:00' },
    { id: 2, worker_id: 3, task_type: 'transport',   assigned_date: '2026-05-22', status: 'in_progress', priority: 'high',   details: 'Load truck for KL delivery',           created_at: '2026-05-21T08:30:00' },
    { id: 3, worker_id: 2, task_type: 'inspection',  assigned_date: '2026-05-22', status: 'completed',   priority: 'medium', details: 'Field condition check — Block B',       created_at: '2026-05-20T09:00:00' },
    { id: 4, worker_id: 4, task_type: 'maintenance', assigned_date: '2026-05-24', status: 'pending',     priority: 'low',    details: 'Service irrigation system',             created_at: '2026-05-21T10:00:00' },
    { id: 5, worker_id: 3, task_type: 'harvest',     assigned_date: '2026-05-25', status: 'pending',     priority: 'medium', details: 'Harvest Block D-2',                     created_at: '2026-05-21T11:00:00' },
  ]

  const load = async () => {
    try {
      const d = await apiClient.listSchedules()
      setSchedules(d.items || [])
    } catch {
      setSchedules(DEMO_SCHEDULES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModal(true) }
  const openEdit   = (s: Schedule) => {
    setEditing(s)
    setForm({
      task_type:     s.task_type,
      assigned_date: s.assigned_date,
      status:        s.status,
      priority:      s.priority || 'medium',
      details:       s.details || '',
      worker_id:     s.worker_id,
    })
    setModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSub(true)
    try {
      const payload = { ...form } as any
      if (editing) {
        await apiClient.updateSchedule(editing.id, payload)
        showToast('Schedule updated', 'success')
      } else {
        await apiClient.createSchedule(payload)
        showToast('Schedule created', 'success')
      }
      setModal(false)
      load()
    } catch {
      showToast('Failed to save', 'error')
    } finally {
      setSub(false)
    }
  }

  const quickStatus = async (id: number, status: Schedule['status']) => {
    try {
      await apiClient.updateSchedule(id, { status })
      showToast('Status updated', 'success')
      load()
    } catch {
      showToast('Update failed', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteSchedule(id)
      showToast('Schedule deleted', 'success')
      setDel(null)
      load()
    } catch {
      showToast('Delete failed', 'error')
    }
  }

  const filtered = schedules.filter((s) => {
    const matchSearch = s.task_type.includes(search.toLowerCase()) || (s.details?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchStatus = statusFilter === 'All' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    pending:     schedules.filter(s => s.status === 'pending').length,
    in_progress: schedules.filter(s => s.status === 'in_progress').length,
    completed:   schedules.filter(s => s.status === 'completed').length,
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Assign and track farm worker tasks</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Task
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tasks',  value: schedules.length, color: 'text-gray-900' },
            { label: 'Pending',      value: counts.pending,   color: 'text-amber-600' },
            { label: 'In Progress',  value: counts.in_progress, color: 'text-blue-600' },
            { label: 'Completed',    value: counts.completed, color: 'text-green-600' },
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
            <input type="text" placeholder="Search tasks…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex gap-2">
            {['All', 'pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  statusFilter === s ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s === 'All' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Task cards / table */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Calendar size={36} className="mb-2 opacity-30" />
            <p className="font-medium">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Icon + task info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {(() => {
                    const t = TASK_ICONS[s.task_type] || TASK_ICONS.other
                    return (
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                        <t.icon size={17} />
                      </div>
                    )
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 capitalize">{s.task_type.replace('_', ' ')}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[s.status] || 'bg-gray-100 text-gray-700'}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                      {s.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_STYLES[s.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {s.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{s.assigned_date} · Worker #{s.worker_id}</p>
                    {s.details && <p className="text-sm text-gray-600 mt-1 truncate">{s.details}</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {s.status === 'pending' && (
                    <button onClick={() => quickStatus(s.id, 'in_progress')}
                      className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors">
                      Start
                    </button>
                  )}
                  {s.status === 'in_progress' && (
                    <button onClick={() => quickStatus(s.id, 'completed')}
                      className="px-3 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors">
                      Complete
                    </button>
                  )}
                  <button onClick={() => openEdit(s)}
                    className="p-2 rounded-lg hover:bg-purple-50 text-purple-500 hover:text-purple-700">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDel(s.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} title={editing ? 'Edit Task' : 'New Task'} onClose={() => setModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Task Type *</label>
              <select value={form.task_type} onChange={(e) => setForm({...form, task_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {['harvest', 'transport', 'inspection', 'maintenance', 'other'].map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date *</label>
              <input type="date" value={form.assigned_date} onChange={(e) => setForm({...form, assigned_date: e.target.value})}
                required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {['low', 'medium', 'high'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {['pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Task Details</label>
              <textarea value={form.details} onChange={(e) => setForm({...form, details: e.target.value})}
                rows={3} placeholder="Describe the task…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving…' : editing ? 'Update' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={delConfirm !== null} title="Confirm Delete" onClose={() => setDel(null)}>
        <p className="text-sm text-gray-600 mb-6">Delete this schedule task permanently?</p>
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

