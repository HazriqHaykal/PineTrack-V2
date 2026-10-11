import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Brain, ChevronDown, Search, Sprout } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { Harvest, HarvestStatus, QualityTargets } from '../../types'

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100  text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-red-100   text-red-800',
}

const STATUS_STYLES: Record<HarvestStatus, string> = {
  pending:   'bg-gray-100 text-gray-700',
  graded:    'bg-blue-100 text-blue-800',
  processed: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
}

const HARVEST_STATUSES: HarvestStatus[] = ['pending', 'graded', 'processed', 'rejected']

const DEFAULT_TARGETS: QualityTargets = { id: 0, max_spoilage_rate: 5, max_rejection_rate: 5, updated_at: '' }

const EMPTY_FORM = {
  field_name:     '',
  harvest_date:   new Date().toISOString().split('T')[0],
  quantity_kg:    '',
  quality_grade:  'A',
  ripeness_level: '',
  harvest_status: 'pending' as HarvestStatus,
  spoilage_kg:    '0',
  rejected_kg:    '0',
  notes:          '',
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {msg}
    </div>
  )
}

export default function HarvestPage() {
  const [harvests, setHarvests]   = useState<Harvest[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [gradeFilter, setGrade]   = useState('All')
  const [modalOpen, setModal]     = useState(false)
  const [delConfirm, setDelConfirm] = useState<number | null>(null)
  const [editing, setEditing]     = useState<Harvest | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [aiResult, setAiResult]   = useState<any>(null)
  const [aiModalOpen, setAiModal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHarvest, setAiHarvest] = useState<Harvest | null>(null)
  const [aiForm, setAiForm]       = useState({ ripeness_level: 5, days_since_last_harvest: 14, field_condition_score: 7 })
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [targets, setTargets]     = useState<QualityTargets>(DEFAULT_TARGETS)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    try {
      const data = await apiClient.listHarvests()
      setHarvests(data.items || [])
    } catch (err) {
      setHarvests([])
      showToast(apiErrorMessage(err, 'Failed to load harvests'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadTargets = async () => {
    try {
      const data = await apiClient.getQualityTargets()
      setTargets(data)
    } catch {
      setTargets(DEFAULT_TARGETS)
    }
  }

  useEffect(() => { load(); loadTargets() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setModal(true)
  }

  const openEdit = (h: Harvest) => {
    setEditing(h)
    setForm({
      field_name:     h.field_name,
      harvest_date:   h.harvest_date,
      quantity_kg:    String(h.quantity_kg),
      quality_grade:  h.quality_grade,
      ripeness_level: h.ripeness_level ? String(h.ripeness_level) : '',
      harvest_status: h.harvest_status,
      spoilage_kg:    String(h.spoilage_kg),
      rejected_kg:    String(h.rejected_kg),
      notes:          h.notes || '',
    })
    setModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editing) {
        await apiClient.updateHarvest(editing.id, {
          quality_grade:  form.quality_grade as Harvest['quality_grade'],
          ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
          harvest_status: form.harvest_status,
          spoilage_kg:    parseFloat(form.spoilage_kg) || 0,
          rejected_kg:    parseFloat(form.rejected_kg) || 0,
          notes:          form.notes,
        })
        showToast('Harvest updated', 'success')
      } else {
        await apiClient.createHarvest({
          field_name:     form.field_name,
          harvest_date:   form.harvest_date,
          quantity_kg:    parseFloat(form.quantity_kg),
          quality_grade:  form.quality_grade as Harvest['quality_grade'],
          ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
          notes:          form.notes,
        })
        showToast('Harvest created', 'success')
      }
      setModal(false)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to save harvest'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteHarvest(id)
      showToast('Harvest deleted', 'success')
      setDelConfirm(null)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to delete'), 'error')
    }
  }

  const openAI = (h: Harvest) => {
    setAiHarvest(h)
    setAiResult(null)
    setAiModal(true)
  }

  const runAI = async () => {
    if (!aiHarvest) return
    setAiLoading(true)
    try {
      const result = await apiClient.predictHarvestTiming({
        harvest_id: aiHarvest.id,
        ...aiForm,
      })
      setAiResult(result)
    } catch (err) {
      showToast(apiErrorMessage(err, 'PineTrack Agent could not respond'), 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const filtered = harvests.filter((h) => {
    const q = search.toLowerCase()
    const matchSearch = h.field_name.toLowerCase().includes(q) || h.batch_number?.toLowerCase().includes(q)
    const matchGrade  = gradeFilter === 'All' || h.quality_grade === gradeFilter
    return matchSearch && matchGrade
  })

  const totalQty       = filtered.reduce((s, h) => s + h.quantity_kg, 0)
  const totalSpoilage  = filtered.reduce((s, h) => s + h.spoilage_kg, 0)
  const totalRejected  = filtered.reduce((s, h) => s + h.rejected_kg, 0)
  const totalYield     = filtered.reduce((s, h) => s + h.marketable_yield_kg, 0)
  const yieldPct        = totalQty ? Math.round((totalYield / totalQty) * 1000) / 10 : 0
  const spoilageRatePct  = totalQty ? Math.round((totalSpoilage / totalQty) * 1000) / 10 : 0
  const rejectionRatePct = totalQty ? Math.round((totalRejected / totalQty) * 1000) / 10 : 0
  const spoilageOverTarget  = spoilageRatePct  > targets.max_spoilage_rate
  const rejectionOverTarget = rejectionRatePct > targets.max_rejection_rate

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Harvest Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage pineapple harvest batches</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Harvest
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Batches', value: harvests.length },
            { label: 'Total Volume', value: `${totalQty.toLocaleString()} kg` },
            { label: 'Marketable Yield', value: `${yieldPct}%` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
          <div className={`rounded-xl border shadow-sm px-4 py-3 ${spoilageOverTarget ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Spoilage Rate</p>
            <p className={`text-xl font-bold mt-0.5 ${spoilageOverTarget ? 'text-red-700' : 'text-gray-900'}`}>
              {spoilageRatePct}% <span className="text-xs font-medium text-gray-400">/ target {targets.max_spoilage_rate}%</span>
            </p>
          </div>
          <div className={`rounded-xl border shadow-sm px-4 py-3 ${rejectionOverTarget ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Rejection Rate</p>
            <p className={`text-xl font-bold mt-0.5 ${rejectionOverTarget ? 'text-red-700' : 'text-gray-900'}`}>
              {rejectionRatePct}% <span className="text-xs font-medium text-gray-400">/ target {targets.max_rejection_rate}%</span>
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by batch # or field name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={(e) => setGrade(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {['All', 'A', 'B', 'C', 'D'].map((g) => (
                <option key={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
              Loading harvests…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Sprout size={36} className="mb-2 opacity-30" />
              <p className="font-medium">No harvests found</p>
              <p className="text-sm mt-1">Try adjusting filters or create a new harvest</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Batch #', 'Field Name', 'Date', 'Quantity (kg)', 'Grade', 'Ripeness', 'Status', 'Yield', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h, i) => (
                    <tr
                      key={h.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.batch_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{h.field_name}</td>
                      <td className="px-4 py-3 text-gray-600">{h.harvest_date}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{h.quantity_kg.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${GRADE_STYLES[h.quality_grade] || 'bg-gray-100 text-gray-700'}`}>
                          Grade {h.quality_grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {h.ripeness_level != null ? `${h.ripeness_level}/10` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[h.harvest_status] || 'bg-gray-100 text-gray-700'}`}>
                          {h.harvest_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${h.marketable_yield_percent < 90 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {h.marketable_yield_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAI(h)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 hover:text-purple-700 transition-colors"
                            title="Ask PineTrack Agent"
                          >
                            <Brain size={15} />
                          </button>
                          <button
                            onClick={() => openEdit(h)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDelConfirm(h.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
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

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Harvest' : 'New Harvest Batch'}
        onClose={() => setModal(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Field Name *</label>
              <input
                type="text"
                value={form.field_name}
                onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                disabled={!!editing}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="e.g. Field Block A-3"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Harvest Date *</label>
              <input
                type="date"
                value={form.harvest_date}
                onChange={(e) => setForm({ ...form, harvest_date: e.target.value })}
                disabled={!!editing}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Quantity (kg) *</label>
              <input
                type="number"
                value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                min="0.1" step="0.1"
                disabled={!!editing}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Quality Grade *</label>
              <select
                value={form.quality_grade}
                onChange={(e) => setForm({ ...form, quality_grade: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {['A', 'B', 'C', 'D'].map((g) => (
                  <option key={g} value={g}>Grade {g}{g === 'A' ? ' (Best)' : g === 'D' ? ' (Poor)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Ripeness Level (0–10)</label>
              <input
                type="number"
                value={form.ripeness_level}
                onChange={(e) => setForm({ ...form, ripeness_level: e.target.value })}
                min="0" max="10" step="0.1"
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {editing && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Harvest Status</label>
                  <select
                    value={form.harvest_status}
                    onChange={(e) => setForm({ ...form, harvest_status: e.target.value as HarvestStatus })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 capitalize"
                  >
                    {HARVEST_STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Spoilage (kg)</label>
                    <input
                      type="number"
                      value={form.spoilage_kg}
                      onChange={(e) => setForm({ ...form, spoilage_kg: e.target.value })}
                      min="0" step="0.1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rejected (kg)</label>
                    <input
                      type="number"
                      value={form.rejected_kg}
                      onChange={(e) => setForm({ ...form, rejected_kg: e.target.value })}
                      min="0" step="0.1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">
                    Marketable yield is calculated automatically: {Math.max(parseFloat(form.quantity_kg || '0') - (parseFloat(form.spoilage_kg) || 0) - (parseFloat(form.rejected_kg) || 0), 0).toFixed(1)} kg
                  </p>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {submitting ? 'Saving…' : editing ? 'Update Harvest' : 'Create Harvest'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={delConfirm !== null} title="Confirm Delete" onClose={() => setDelConfirm(null)}>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this harvest record? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDelConfirm(null)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => delConfirm !== null && handleDelete(delConfirm)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
            Delete
          </button>
        </div>
      </Modal>

      {/* AI Modal */}
      <Modal open={aiModalOpen} title="PineTrack Agent: Harvest Timing" onClose={() => setAiModal(false)}>
        {aiHarvest && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-gray-700">{aiHarvest.field_name}</p>
              <p className="text-gray-500">Harvested {aiHarvest.harvest_date} · Grade {aiHarvest.quality_grade} · {aiHarvest.quantity_kg} kg</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ripeness Level (0–10)', key: 'ripeness_level', max: 10 },
                { label: 'Days Since Last Harvest', key: 'days_since_last_harvest', max: 90 },
                { label: 'Field Condition (0–10)', key: 'field_condition_score', max: 10 },
              ].map(({ label, key, max }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                  <input
                    type="number"
                    value={(aiForm as any)[key]}
                    onChange={(e) => setAiForm({ ...aiForm, [key]: parseFloat(e.target.value) })}
                    min="0" max={max} step="0.1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={runAI}
              disabled={aiLoading}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Brain size={16} />
              {aiLoading ? 'Analyzing…' : 'Ask PineTrack Agent'}
            </button>

            {aiResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-purple-900 text-lg">{aiResult.recommendation}</p>
                  <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                    {Math.round(aiResult.confidence_score * 100)}% confidence
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <p className="text-xs text-gray-400 uppercase">Quality</p>
                    <p className="font-semibold text-gray-800">{aiResult.quality_prediction}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <p className="text-xs text-gray-400 uppercase">Transport Priority</p>
                    <p className="font-semibold text-gray-800">{aiResult.transport_priority}</p>
                  </div>
                </div>
                {aiResult.explanation && (
                  <p className="text-xs text-gray-700 leading-relaxed">{aiResult.explanation}</p>
                )}
                <p className="text-xs text-purple-700">
                  Readiness score: {aiResult.reasoning?.total_score}/100 · {aiResult.source === 'gemini' ? 'PineTrack Agent' : 'Built-in rules'}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  )
}

