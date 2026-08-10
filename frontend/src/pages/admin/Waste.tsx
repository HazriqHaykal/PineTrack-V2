import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Recycle, Search } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient } from '../../services/api'
import { Waste } from '../../types'

const WASTE_TYPE_STYLES: Record<string, string> = {
  rotten:       'bg-red-100    text-red-800',
  damaged:      'bg-orange-100 text-orange-800',
  overripe:     'bg-amber-100  text-amber-800',
  unused_parts: 'bg-blue-100   text-blue-800',
  other:        'bg-gray-100   text-gray-700',
}

const CLASS_STYLES: Record<string, string> = {
  compostable:     'bg-green-100  text-green-800',
  recyclable:      'bg-blue-100   text-blue-800',
  'non-recyclable':'bg-red-100    text-red-800',
}

const EMPTY_FORM = {
  waste_type:      'rotten',
  quantity_kg:     '',
  classification:  'compostable',
  disposal_method: '',
  notes:           '',
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

export default function WastePage() {
  const [records, setRecords]   = useState<Waste[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setType]   = useState('All')
  const [modalOpen, setModal]   = useState(false)
  const [delConfirm, setDel]    = useState<number | null>(null)
  const [editing, setEditing]   = useState<Waste | null>(null)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [submitting, setSub]    = useState(false)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const DEMO_WASTE: Waste[] = [
    { id: 1, waste_type: 'rotten',       quantity_kg: 45,  classification: 'compostable',     disposal_method: 'compost',  notes: 'From Block C-2',   created_at: '2026-05-20T10:00:00' },
    { id: 2, waste_type: 'damaged',      quantity_kg: 32,  classification: 'compostable',     disposal_method: 'compost',  notes: 'Transit damage',   created_at: '2026-05-19T09:00:00' },
    { id: 3, waste_type: 'unused_parts', quantity_kg: 18,  classification: 'recyclable',      disposal_method: 'donate',   notes: 'Crowns & leaves',  created_at: '2026-05-18T11:00:00' },
    { id: 4, waste_type: 'overripe',     quantity_kg: 28,  classification: 'compostable',     disposal_method: 'compost',  notes: '',                 created_at: '2026-05-17T08:00:00' },
    { id: 5, waste_type: 'other',        quantity_kg: 12,  classification: 'non-recyclable',  disposal_method: 'discard',  notes: 'Contaminated',     created_at: '2026-05-16T14:00:00' },
  ]

  const load = async () => {
    try {
      const d = await apiClient.listWaste()
      setRecords(d.items || [])
    } catch {
      setRecords(DEMO_WASTE)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModal(true) }
  const openEdit   = (w: Waste) => {
    setEditing(w)
    setForm({
      waste_type:      w.waste_type,
      quantity_kg:     String(w.quantity_kg),
      classification:  w.classification,
      disposal_method: w.disposal_method || '',
      notes:           w.notes || '',
    })
    setModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSub(true)
    try {
      const payload = { ...form, quantity_kg: parseFloat(form.quantity_kg) } as any
      if (editing) {
        await apiClient.updateWaste(editing.id, payload)
        showToast('Record updated', 'success')
      } else {
        await apiClient.createWaste(payload)
        showToast('Record created', 'success')
      }
      setModal(false)
      load()
    } catch {
      showToast('Failed to save', 'error')
    } finally {
      setSub(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteWaste(id)
      showToast('Record deleted', 'success')
      setDel(null)
      load()
    } catch {
      showToast('Delete failed', 'error')
    }
  }

  const filtered = records.filter((r) => {
    const matchSearch = r.waste_type.includes(search.toLowerCase()) || (r.notes?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchType   = typeFilter === 'All' || r.waste_type === typeFilter
    return matchSearch && matchType
  })

  const compostableKg  = records.filter(r => r.classification === 'compostable').reduce((s,r) => s + r.quantity_kg, 0)
  const recyclableKg   = records.filter(r => r.classification === 'recyclable').reduce((s,r) => s + r.quantity_kg, 0)

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Waste Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and classify post-harvest waste</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Log Waste
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Records',    value: records.length             },
            { label: 'Total Waste (kg)', value: records.reduce((s,r) => s + r.quantity_kg, 0).toFixed(1) },
            { label: 'Compostable (kg)', value: compostableKg.toFixed(1)  },
            { label: 'Recyclable (kg)',  value: recyclableKg.toFixed(1)   },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Environmental KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Composted',   pct: records.length ? Math.round(compostableKg / records.reduce((s,r) => s + r.quantity_kg, 1) * 100) : 0, color: 'bg-green-500'  },
            { label: 'Recycled',    pct: records.length ? Math.round(recyclableKg / records.reduce((s,r) => s + r.quantity_kg, 1) * 100) : 0,  color: 'bg-blue-500'   },
            { label: 'Waste Score', pct: 100 - (records.length ? Math.round(records.filter(r=>r.classification==='non-recyclable').reduce((s,r)=>s+r.quantity_kg,0) / records.reduce((s,r)=>s+r.quantity_kg,1) * 100) : 0), color: 'bg-purple-500' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{kpi.label}</p>
                <p className="text-lg font-bold text-gray-900">{kpi.pct}%</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${kpi.color} rounded-full transition-all duration-500`} style={{ width: `${kpi.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search waste records…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['All', 'rotten', 'damaged', 'overripe', 'unused_parts', 'other'].map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  typeFilter === t ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {t === 'All' ? 'All Types' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Recycle size={36} className="mb-2 opacity-30" />
              <p className="font-medium">No waste records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Type', 'Quantity (kg)', 'Classification', 'Disposal Method', 'Date', 'Notes', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${WASTE_TYPE_STYLES[r.waste_type] || 'bg-gray-100 text-gray-700'}`}>
                          {r.waste_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.quantity_kg.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${CLASS_STYLES[r.classification] || 'bg-gray-100 text-gray-700'}`}>
                          {r.classification.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{r.disposal_method || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.created_at?.split('T')[0] || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500 hover:text-orange-700">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDel(r.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} title={editing ? 'Edit Waste Record' : 'Log Waste'} onClose={() => setModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Waste Type *</label>
              <select value={form.waste_type} onChange={(e) => setForm({...form, waste_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {['rotten', 'damaged', 'overripe', 'unused_parts', 'other'].map((t) => (
                  <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Quantity (kg) *</label>
              <input type="number" value={form.quantity_kg} onChange={(e) => setForm({...form, quantity_kg: e.target.value})}
                min="0.1" step="0.1" required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Classification *</label>
              <select value={form.classification} onChange={(e) => setForm({...form, classification: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {['compostable', 'recyclable', 'non-recyclable'].map((c) => (
                  <option key={c} value={c} className="capitalize">{c.replace('-', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Disposal Method</label>
              <input type="text" value={form.disposal_method} onChange={(e) => setForm({...form, disposal_method: e.target.value})}
                placeholder="e.g. compost, donate"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}
                rows={3} placeholder="Optional notes…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving…' : editing ? 'Update' : 'Log Waste'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={delConfirm !== null} title="Confirm Delete" onClose={() => setDel(null)}>
        <p className="text-sm text-gray-600 mb-6">Delete this waste record permanently?</p>
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

