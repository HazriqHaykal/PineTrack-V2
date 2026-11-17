import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Lightbulb, Search, Sprout, Eye } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useCreateFromQuery } from '../../hooks/useCreateFromQuery'
import LifecycleBadge from '../../components/batch/LifecycleBadge'
import { GRADES, isMixed, normalizeGrade } from '../../components/batch/GradeBadge'
import GradeSummary from '../../components/batch/GradeSummary'
import GradingFields from '../../components/batch/GradingFields'
import {
  EMPTY_GRADE_INPUTS, GradeInputs, fmtKg, gradeInputsFrom, gradesPayload, previewGrading, sameGrades,
} from '../../components/batch/grading'
import { useMarketabilityPolicy } from '../../hooks/useMarketabilityPolicy'
import StatusGuide from '../../components/batch/StatusGuide'
import IconButton from '../../components/ui/IconButton'
import { apiClient, apiErrorMessage } from '../../services/api'
import { BatchSummary, Harvest, HarvestStatus, QualityTargets } from '../../types'
import AppSelect from '../../components/ui/AppSelect'

import { tr, trEnum } from '../../i18n'
/** Raw filter values; labels are for display only */
const GRADE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: tr("All grades") },
  ...GRADES.map((g) => ({ value: g, label: tr("Contains Grade {0}", g) })),
  { value: 'mixed', label: tr("Mixed grades") },
  { value: 'legacy', label: tr("Legacy (single grade)") },
  { value: 'ungraded', label: tr("Ungraded") },
]

function matchesGrade(h: Harvest, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === 'ungraded') return h.grading_basis === 'ungraded'
  if (filter === 'legacy') return h.grading_basis === 'legacy'
  if (filter === 'mixed') return isMixed(h.quality_grade)
  // A grade: batches holding any kg of it, or legacy batches graded as it
  if (h.grade_quantities) return (h.grade_quantities[filter as keyof typeof h.grade_quantities] ?? 0) > 0
  return normalizeGrade(h.quality_grade) === filter
}

const HARVEST_STATUSES: HarvestStatus[] = ['pending', 'graded', 'processed', 'rejected']

const DEFAULT_TARGETS: QualityTargets = { id: 0, max_spoilage_rate: 5, max_rejection_rate: 5, updated_at: '' }

const EMPTY_FORM = {
  field_name:     '',
  harvest_date:   new Date().toISOString().split('T')[0],
  quantity_kg:    '',
  grades:         { ...EMPTY_GRADE_INPUTS } as GradeInputs,
  ripeness_level: '',
  harvest_status: 'pending' as HarvestStatus,
  spoilage_kg:    '0',
  /** Graded batches: rejected after grading. Others: total rejected */
  rejected_kg:    '0',
  non_marketable: '',
  non_marketable_reason: 'damaged',
  notes:          '',
}

function Modal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
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
  const navigate = useNavigate()
  const [harvests, setHarvests]   = useState<Harvest[]>([])
  const [batchInfo, setBatchInfo] = useState<Record<number, BatchSummary>>({})
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [gradeFilter, setGrade]   = useState('all')
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
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [targetForm, setTargetForm] = useState({ max_spoilage_rate: '', max_rejection_rate: '' })
  const [targetsSaving, setTargetsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { policy } = useMarketabilityPolicy()

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    try {
      const [data, summaries] = await Promise.all([apiClient.listHarvests(), apiClient.getBatchOverview()])
      setHarvests(data.items || [])
      setBatchInfo(Object.fromEntries(summaries.map((s) => [s.harvest_id, s])))
    } catch (err) {
      setHarvests([])
      showToast(apiErrorMessage(err, tr("Failed to load harvests")), 'error')
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

  const openTargets = () => {
    setTargetForm({
      max_spoilage_rate:  String(targets.max_spoilage_rate),
      max_rejection_rate: String(targets.max_rejection_rate),
    })
    setTargetsOpen(true)
  }

  const saveTargets = async (e: React.FormEvent) => {
    e.preventDefault()
    setTargetsSaving(true)
    try {
      const updated = await apiClient.updateQualityTargets({
        max_spoilage_rate:  parseFloat(targetForm.max_spoilage_rate),
        max_rejection_rate: parseFloat(targetForm.max_rejection_rate),
      })
      setTargets(updated)
      setTargetsOpen(false)
      showToast(tr("Quality targets updated"), 'success')
    } catch (err) {
      showToast(apiErrorMessage(err, tr("Failed to update targets")), 'error')
    } finally {
      setTargetsSaving(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, grades: { ...EMPTY_GRADE_INPUTS } })
    setFormError('')
    setModal(true)
  }

  useCreateFromQuery(openCreate)

  const openEdit = (h: Harvest) => {
    setEditing(h)
    setForm({
      field_name:     h.field_name,
      harvest_date:   h.harvest_date,
      quantity_kg:    String(h.quantity_kg),
      grades:         gradeInputsFrom(h.grade_quantities),
      ripeness_level: h.ripeness_level ? String(h.ripeness_level) : '',
      harvest_status: h.harvest_status,
      spoilage_kg:    String(h.spoilage_kg),
      rejected_kg:    String(h.grading_basis === 'grade_based' ? (h.rejected_after_grading_kg ?? 0) : h.rejected_kg),
      non_marketable: h.rejected_at_sorting_kg ? String(h.rejected_at_sorting_kg) : '',
      non_marketable_reason: 'damaged',
      notes:          h.notes || '',
    })
    setFormError('')
    setModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const grading = previewGrading(form.quantity_kg, form.grades, [], form.non_marketable)
    const sortedOut = Number(form.non_marketable) || 0
    if (!grading.empty && grading.error) {
      setFormError(tr("Grading breakdown: {0}", grading.error))
      return
    }
    if (editing?.grading_basis === 'grade_based' && grading.empty) {
      setFormError(tr("A graded batch keeps its grade quantities. Enter them again or cancel."))
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      if (editing) {
        const gradesChanged = !grading.empty && (
          !sameGrades(form.grades, gradeInputsFrom(editing.grade_quantities))
          || Math.round(sortedOut * 100) !== Math.round((editing.rejected_at_sorting_kg ?? 0) * 100)
        )
        const rejectedInput = parseFloat(form.rejected_kg) || 0
        await apiClient.updateHarvest(editing.id, {
          grades:         gradesChanged ? gradesPayload(form.grades, form.non_marketable) : undefined,
          ...(gradesChanged ? { non_marketable_kg: sortedOut, non_marketable_reason: form.non_marketable_reason } : {}),
          ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
          harvest_status: form.harvest_status,
          spoilage_kg:    parseFloat(form.spoilage_kg) || 0,
          // Graded: total rejection = non-marketable at sorting + rejected after grading
          rejected_kg:    grading.empty ? rejectedInput : Math.round((sortedOut + rejectedInput) * 100) / 100,
          notes:          form.notes,
        })
        showToast(tr("Harvest updated"), 'success')
      } else {
        await apiClient.createHarvest({
          field_name:     form.field_name,
          harvest_date:   form.harvest_date,
          quantity_kg:    parseFloat(form.quantity_kg),
          grades:         gradesPayload(form.grades, form.non_marketable),
          ...(sortedOut > 0 ? { non_marketable_kg: sortedOut, non_marketable_reason: form.non_marketable_reason } : {}),
          ripeness_level: form.ripeness_level ? parseFloat(form.ripeness_level) : undefined,
          notes:          form.notes,
        })
        showToast(tr("Harvest created"), 'success')
      }
      setModal(false)
      load()
    } catch (err) {
      setFormError(apiErrorMessage(err, tr("Failed to save harvest")))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteHarvest(id)
      showToast(tr("Harvest deleted"), 'success')
      setDelConfirm(null)
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, tr("Failed to delete")), 'error')
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
      showToast(apiErrorMessage(err, tr("PineTrack Agent could not respond")), 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const filtered = harvests.filter((h) => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q
      || (h.field_name ?? '').toLowerCase().includes(q)
      || (h.batch_number ?? '').toLowerCase().includes(q)
    return matchSearch && matchesGrade(h, gradeFilter)
  })

  const totalQty       = filtered.reduce((s, h) => s + h.quantity_kg, 0)
  const totalSpoilage  = filtered.reduce((s, h) => s + h.spoilage_kg, 0)
  const totalRejected  = filtered.reduce((s, h) => s + h.rejected_kg, 0)
  // Farm marketable yield is weighted by quantity and uses grade-based batches only
  const gradeBased     = filtered.filter((h) => h.grading_basis === 'grade_based')
  const gradedQty      = gradeBased.reduce((s, h) => s + h.quantity_kg, 0)
  const gradedYield    = gradeBased.reduce((s, h) => s + h.marketable_yield_kg, 0)
  const yieldPct       = gradedQty ? Math.round((gradedYield / gradedQty) * 1000) / 10 : null
  const excluded       = filtered.length - gradeBased.length
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
            <h1 className="text-2xl font-bold text-gray-900">{tr("Harvest Management")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tr("Track and manage pineapple harvest batches")}</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto"
          >
            <Plus size={16} strokeWidth={2} /> {tr("New Harvest")}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: tr("Total Batches"), value: harvests.length },
            { label: tr("Total Volume"), value: `${totalQty.toLocaleString()} kg` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              <span title={tr("Sum of marketable kg divided by sum of harvested kg, over batches with recorded grade quantities. Legacy and ungraded batches are left out.")}
                className="cursor-help">{tr("Marketable Yield")}</span>
            </p>
            <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{yieldPct != null ? `${yieldPct}%` : '—'}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {gradeBased.length ? tr("{0} marketable", fmtKg(Math.round(gradedYield * 100) / 100)) : tr("No grade-based batches")}
              {excluded > 0 && ` · ${excluded} excluded`}
            </p>
          </div>
          {[
            { label: tr("Spoilage Rate"),  rate: spoilageRatePct,  target: targets.max_spoilage_rate,  over: spoilageOverTarget },
            { label: tr("Rejection Rate"), rate: rejectionRatePct, target: targets.max_rejection_rate, over: rejectionOverTarget },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border shadow-sm px-4 py-3 ${c.over ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                <button
                  type="button"
                  onClick={openTargets}
                  title={tr("Edit quality targets")}
                  aria-label={tr("Edit {0} target", c.label.toLowerCase())}
                  className="-mr-1.5 -my-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
              </div>
              <p className={`text-xl font-bold mt-0.5 ${c.over ? 'text-red-700' : 'text-gray-900'}`}>
                {c.rate}% <span className="text-xs font-medium text-gray-500">{tr("/ target")} {c.target}%</span>
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={tr("Search by batch # or field name…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tr("Search harvests")}
              className="w-full h-9 pl-9 pr-4 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <AppSelect size="sm" aria-label={tr("Filter by grade")} value={gradeFilter} onChange={setGrade}
            highlighted={gradeFilter !== 'all'} triggerClassName="sm:w-52"
            options={GRADE_FILTERS} />
          <div className="sm:ml-auto flex items-center gap-3">
            {(search || gradeFilter !== 'all') && (
              <span className="text-xs text-gray-500">{filtered.length} {tr("of")} {harvests.length} {tr("batches")}</span>
            )}
            <StatusGuide />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
              {tr("Loading harvests…")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Sprout size={36} className="mb-2 opacity-30" />
              <p className="font-medium">{tr("No harvests found")}</p>
              <p className="text-sm mt-1">{tr("Try adjusting filters or create a new harvest")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      [tr("Batch"), 'w-[28%]'],
                      [tr("Harvested"), ''],
                      [tr("Quantity"), 'text-right'],
                      [tr("Grade"), ''],
                      [tr("Lifecycle"), ''],
                      [tr("Actions"), 'text-right'],
                    ].map(([h, cls]) => (
                      <th key={h} className={`text-left px-4 py-3 text-xs text-gray-600 font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => {
                    const info = batchInfo[h.id]
                    return (
                      <tr key={h.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/harvest/${h.id}`)}
                            className="text-sm font-bold text-gray-900 hover:text-green-700 whitespace-nowrap tabular-nums"
                          >
                            {h.batch_number}
                          </button>
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[240px]" title={h.field_name}>{h.field_name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap tabular-nums">{h.harvest_date}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                          {h.quantity_kg.toLocaleString()} {tr("kg")}
                        </td>
                        <td className="px-4 py-3">
                          <GradeSummary harvest={h} />
                        </td>
                        <td className="px-4 py-3">
                          {info ? <LifecycleBadge code={info.lifecycle_status} label={tr(info.lifecycle_label)} /> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton icon={Eye} label={tr("View {0}", h.batch_number)} onClick={() => navigate(`/harvest/${h.id}`)} />
                            <IconButton icon={Lightbulb} label={tr("PineTrack Agent insights for {0}", h.batch_number)} onClick={() => openAI(h)} />
                            <IconButton icon={Pencil} label={tr("Edit {0}", h.batch_number)} onClick={() => openEdit(h)} />
                            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
                            <IconButton icon={Trash2} label={tr("Delete {0}", h.batch_number)} onClick={() => setDelConfirm(h.id)} danger />
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

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? tr("Edit Harvest") : tr("New Harvest Batch")}
        onClose={() => setModal(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Field Name *")}</label>
              <input
                type="text"
                value={form.field_name}
                onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                disabled={!!editing}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={tr("e.g. Field Block A-3")}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Harvest Date *")}</label>
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
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Quantity (kg) *")}</label>
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
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Ripeness Level (0–10)")}</label>
              <input
                type="number"
                value={form.ripeness_level}
                onChange={(e) => setForm({ ...form, ripeness_level: e.target.value })}
                min="0" max="10" step="0.1"
                placeholder={tr("Optional")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-900">{tr("Grading Breakdown")}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                {editing?.grading_basis === 'legacy'
                  ? tr("Legacy record graded as a single Grade {0}. Enter the kg of each grade to switch it to grade-based yield, or leave blank to keep it as is.", editing.quality_grade)
                  : tr("Kilograms of each grade, as sorted by the farmer. Leave all blank if the batch has not been graded yet.")}
              </p>
              <GradingFields
                total={form.quantity_kg}
                values={form.grades}
                onChange={(grades) => setForm({ ...form, grades })}
                nonMarketable={form.non_marketable}
                onNonMarketableChange={(v) => setForm({ ...form, non_marketable: v })}
                reason={form.non_marketable_reason}
                onReasonChange={(v) => setForm({ ...form, non_marketable_reason: v })}
                emptyHint={editing?.grading_basis === 'grade_based'
                  ? tr("A graded batch must keep its grade quantities.")
                  : tr("No grades entered: the batch stays ungraded.")}
                idPrefix="harvest-grade"
              />
            </div>

            {editing && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Harvest Status")}</label>
                  <AppSelect
                    aria-label={tr("Harvest status")}
                    value={form.harvest_status}
                    onChange={(v) => setForm({ ...form, harvest_status: v as HarvestStatus })}
                    options={HARVEST_STATUSES.map((s) => ({ value: s, label: trEnum(s).replace(/^\w/, (c) => c.toUpperCase()) }))}
                  />
                </div>
                {(() => {
                  const g = previewGrading(form.quantity_kg, form.grades, policy?.marketable_grades ?? editing.marketable_grades ?? [], form.non_marketable)
                  const spoiled = parseFloat(form.spoilage_kg) || 0
                  const rejected = parseFloat(form.rejected_kg) || 0
                  return !g.empty ? (
                    <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-3">
                      <div>
                        <label htmlFor="spoilage_kg" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Spoilage (kg)")}</label>
                        <input
                          id="spoilage_kg"
                          type="number"
                          value={form.spoilage_kg}
                          onChange={(e) => setForm({ ...form, spoilage_kg: e.target.value })}
                          min="0" step="0.01"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="rejected_kg" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Rejected after grading (kg)")}</label>
                        <input
                          id="rejected_kg"
                          type="number"
                          value={form.rejected_kg}
                          onChange={(e) => setForm({ ...form, rejected_kg: e.target.value })}
                          min="0" step="0.01"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      </div>
                      <p className="col-span-2 text-xs text-gray-600">
                        {tr("Fruit spoiled or rejected after grading is deducted from the graded quantities; non-marketable fruit at sorting is entered above.")}
                        {g.reconciled && tr(" Marketable quantity: {0} (calculated on save).", fmtKg(Math.max(Math.round((g.marketable - spoiled - rejected) * 100) / 100, 0)))}
                      </p>
                    </div>
                  ) : (
                <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Spoilage (kg)")}</label>
                    <input
                      type="number"
                      value={form.spoilage_kg}
                      onChange={(e) => setForm({ ...form, spoilage_kg: e.target.value })}
                      min="0" step="0.1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Rejected (kg)")}</label>
                    <input
                      type="number"
                      value={form.rejected_kg}
                      onChange={(e) => setForm({ ...form, rejected_kg: e.target.value })}
                      min="0" step="0.1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">
                    {editing.grading_basis === 'legacy' ? tr("Legacy calculation") : tr("Provisional, until graded")}{tr(": marketable = harvested − spoilage − rejected =")} {Math.max(parseFloat(form.quantity_kg || '0') - (parseFloat(form.spoilage_kg) || 0) - (parseFloat(form.rejected_kg) || 0), 0).toFixed(2)} {tr("kg")}
                  </p>
                </div>
                  )
                })()}
              </>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{tr("Notes")}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder={tr("Optional notes…")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {tr("Cancel")}
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {submitting ? tr("Saving…") : editing ? tr("Update Harvest") : tr("Create Harvest")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quality targets */}
      <Modal open={targetsOpen} title={tr("Quality Targets")} onClose={() => setTargetsOpen(false)}>
        <form onSubmit={saveTargets} className="space-y-4">
          <p className="text-sm text-gray-600">
            {tr("Maximum acceptable rates, as a percentage of harvested weight. Rate cards turn red when a target is exceeded.")}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {([
              ['max_spoilage_rate',  tr("Max Spoilage (%)")],
              ['max_rejection_rate', tr("Max Rejection (%)")],
            ] as const).map(([key, lbl]) => (
              <div key={key}>
                <label htmlFor={key} className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{lbl}</label>
                <input
                  id={key}
                  type="number"
                  value={targetForm[key]}
                  onChange={(e) => setTargetForm({ ...targetForm, [key]: e.target.value })}
                  min="0" max="100" step="0.1"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{tr("These are the same targets as in Settings; a change here applies everywhere.")}</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setTargetsOpen(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {tr("Cancel")}
            </button>
            <button type="submit" disabled={targetsSaving}
              className="flex-1 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {targetsSaving ? tr("Saving…") : tr("Save Targets")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={delConfirm !== null} title={tr("Confirm Delete")} onClose={() => setDelConfirm(null)}>
        <p className="text-sm text-gray-600 mb-6">
          {tr("Are you sure you want to delete this harvest record? This action cannot be undone.")}
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDelConfirm(null)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            {tr("Cancel")}
          </button>
          <button onClick={() => delConfirm !== null && handleDelete(delConfirm)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
            {tr("Delete")}
          </button>
        </div>
      </Modal>

      {/* AI Modal */}
      <Modal open={aiModalOpen} title={tr("PineTrack Agent: Harvest Timing")} onClose={() => setAiModal(false)}>
        {aiHarvest && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-gray-700">{aiHarvest.field_name}</p>
              <p className="text-gray-500">
                {tr("Harvested")} {aiHarvest.harvest_date} · {isMixed(aiHarvest.quality_grade) ? tr("Mixed grades") : normalizeGrade(aiHarvest.quality_grade) ? tr("Grade {0}", normalizeGrade(aiHarvest.quality_grade)) : tr("Ungraded")} · {aiHarvest.quantity_kg} {tr("kg")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: tr("Ripeness Level (0–10)"), key: 'ripeness_level', max: 10 },
                { label: tr("Days Since Last Harvest"), key: 'days_since_last_harvest', max: 90 },
                { label: tr("Field Condition (0–10)"), key: 'field_condition_score', max: 10 },
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
              <Lightbulb size={16} strokeWidth={1.75} />
              {aiLoading ? tr("Analyzing…") : tr("Ask PineTrack Agent")}
            </button>

            {aiResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-purple-900 text-lg">{aiResult.recommendation}</p>
                  <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                    {Math.round(aiResult.confidence_score * 100)}{tr("% confidence")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <p className="text-xs text-gray-400 uppercase">{tr("Quality")}</p>
                    <p className="font-semibold text-gray-800">{aiResult.quality_prediction}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-purple-100">
                    <p className="text-xs text-gray-400 uppercase">{tr("Transport Priority")}</p>
                    <p className="font-semibold text-gray-800">{aiResult.transport_priority}</p>
                  </div>
                </div>
                {aiResult.explanation && (
                  <p className="text-xs text-gray-700 leading-relaxed">{aiResult.explanation}</p>
                )}
                <p className="text-xs text-purple-700">
                  {tr("Readiness score:")} {aiResult.reasoning?.total_score}/100 · {aiResult.source === 'gemini' ? tr("PineTrack Agent") : tr("Built-in rules")}
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

