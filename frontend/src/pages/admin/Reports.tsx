import { useState } from 'react'
import { FileText, Download, Calendar, Sprout, Truck, Recycle, BarChart3, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage, saveBlob } from '../../services/api'

type ReportType = 'harvest' | 'transport' | 'waste' | 'analytics' | 'full'

interface GeneratedReport {
  id: number
  name: string
  type: ReportType
  period: string
  generated: string
  sizeKb: number
  filename: string
  blob: Blob
}

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { value: 'harvest',   label: 'Harvest Report',    icon: <Sprout   size={18} />, desc: 'Batch list, grades, yields and losses', color: 'text-green-600 bg-green-50 border-green-200'  },
  { value: 'transport', label: 'Transport Report',  icon: <Truck    size={18} />, desc: 'Delivery log and delivery rate',        color: 'text-blue-600 bg-blue-50 border-blue-200'    },
  { value: 'waste',     label: 'Waste Report',      icon: <Recycle  size={18} />, desc: 'Waste log by type and disposal',        color: 'text-orange-600 bg-orange-50 border-orange-200'},
  { value: 'analytics', label: 'Analytics Report',  icon: <BarChart3 size={18} />, desc: 'Summary figures for all modules',      color: 'text-purple-600 bg-purple-50 border-purple-200'},
  { value: 'full',      label: 'Full Operations',   icon: <FileText  size={18} />, desc: 'Summaries plus every record',          color: 'text-slate-600 bg-slate-50 border-slate-200'  },
]

const PERIOD_OPTIONS = [
  { label: 'Last 7 days',    days: 7   },
  { label: 'Last 30 days',   days: 30  },
  { label: 'Last 90 days',   days: 90  },
  { label: 'Last 6 months',  days: 180 },
  { label: 'Last 12 months', days: 365 },
]

const TYPE_ICON: Record<ReportType, React.ReactNode> = {
  harvest:   <Sprout   size={14} className="text-green-600"  />,
  transport: <Truck    size={14} className="text-blue-600"   />,
  waste:     <Recycle  size={14} className="text-orange-600" />,
  analytics: <BarChart3 size={14} className="text-purple-600"/>,
  full:      <FileText  size={14} className="text-slate-600" />,
}

export default function Reports() {
  const [selectedType, setSelectedType] = useState<ReportType>('harvest')
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[1])
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const blob = await apiClient.downloadReport(selectedType, selectedPeriod.days)
      const typeMeta = REPORT_TYPES.find(t => t.value === selectedType)!
      const now = new Date()
      const filename = `pinetrack-${selectedType}-report-${now.toISOString().split('T')[0]}.pdf`
      saveBlob(blob, filename)
      setReports(prev => [{
        id: now.getTime(),
        name: typeMeta.label,
        type: selectedType,
        period: selectedPeriod.label,
        generated: now.toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        filename,
        blob,
      }, ...prev])
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to generate the report.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AdminLayout title="Reports" subtitle="Generate and download operational reports">

      {/* Generate panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-slate-600" />
          <h3 className="text-sm font-bold text-gray-900">Generate New Report</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Report type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Report Type</label>
            <div className="grid grid-cols-1 gap-2">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setSelectedType(rt.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selectedType === rt.value ? rt.color : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedType === rt.value ? '' : 'bg-gray-50'
                  }`}>
                    {rt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{rt.label}</p>
                    <p className="text-[11px] text-gray-500">{rt.desc}</p>
                  </div>
                  {selectedType === rt.value && (
                    <CheckCircle2 size={16} className="text-green-600 ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time Period</label>
            <div className="space-y-2">
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.days}
                  onClick={() => setSelectedPeriod(p)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                    selectedPeriod.days === p.days
                      ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={13} />
                    {p.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-green-100"
        >
          {generating ? (
            <><Clock size={15} className="animate-spin" /> Generating PDF...</>
          ) : (
            <><FileText size={15} /> Generate PDF Report</>
          )}
        </button>
      </div>

      {/* Reports generated in this session */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Generated This Session</h3>
          <span className="text-xs text-gray-500">{reports.length} report{reports.length === 1 ? '' : 's'}</span>
        </div>
        {reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            Reports are built from live data and downloaded straight to your computer. Generate one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-50">
                  <th className="text-left px-5 py-3 font-semibold">Report</th>
                  <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Period</th>
                  <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Generated</th>
                  <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Size</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                          {TYPE_ICON[report.type]}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{report.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{report.period}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-600">{report.generated}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-600">{report.sizeKb} KB</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => saveBlob(report.blob, report.filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                      >
                        <Download size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </AdminLayout>
  )
}
