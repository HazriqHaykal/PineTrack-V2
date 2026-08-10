import { useState } from 'react'
import { FileText, Download, Calendar, Sprout, Truck, Recycle, BarChart3, CheckCircle2, Clock, Eye } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'

type ReportType = 'harvest' | 'transport' | 'waste' | 'analytics' | 'full'
type ReportStatus = 'ready' | 'generating' | 'scheduled'

interface Report {
  id: number
  name: string
  type: ReportType
  period: string
  generated: string
  size: string
  status: ReportStatus
  pages: number
}

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { value: 'harvest',   label: 'Harvest Report',    icon: <Sprout   size={18} />, desc: 'Batch summaries, grades, yields',  color: 'text-green-600 bg-green-50 border-green-200'  },
  { value: 'transport', label: 'Transport Report',  icon: <Truck    size={18} />, desc: 'Delivery logs, route efficiency',  color: 'text-blue-600 bg-blue-50 border-blue-200'    },
  { value: 'waste',     label: 'Waste Report',      icon: <Recycle  size={18} />, desc: 'Waste logs, disposal methods',     color: 'text-orange-600 bg-orange-50 border-orange-200'},
  { value: 'analytics', label: 'Analytics Report',  icon: <BarChart3 size={18} />, desc: 'KPI trends, performance data',   color: 'text-purple-600 bg-purple-50 border-purple-200'},
  { value: 'full',      label: 'Full Operations',   icon: <FileText  size={18} />, desc: 'Complete monthly overview',       color: 'text-slate-600 bg-slate-50 border-slate-200'  },
]

const PERIOD_OPTIONS = ['This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'This Year', 'Custom Range']

const DEMO_REPORTS: Report[] = [
  { id: 1, name: 'Harvest Report – April 2024',     type: 'harvest',   period: 'Apr 2024',  generated: '2024-05-01', size: '1.2 MB', status: 'ready',     pages: 8  },
  { id: 2, name: 'Full Operations – April 2024',    type: 'full',      period: 'Apr 2024',  generated: '2024-05-01', size: '3.8 MB', status: 'ready',     pages: 24 },
  { id: 3, name: 'Waste Report – April 2024',       type: 'waste',     period: 'Apr 2024',  generated: '2024-05-02', size: '0.9 MB', status: 'ready',     pages: 6  },
  { id: 4, name: 'Transport Report – March 2024',   type: 'transport', period: 'Mar 2024',  generated: '2024-04-01', size: '1.5 MB', status: 'ready',     pages: 10 },
  { id: 5, name: 'Analytics Report – Q1 2024',      type: 'analytics', period: 'Q1 2024',   generated: '2024-04-05', size: '2.1 MB', status: 'ready',     pages: 16 },
  { id: 6, name: 'Harvest Report – May 2024',       type: 'harvest',   period: 'May 2024',  generated: '—',          size: '—',      status: 'scheduled', pages: 0  },
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
  const [reports, setReports] = useState<Report[]>(DEMO_REPORTS)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerated(false)
    const newId = reports.length + 1
    const typeMeta = REPORT_TYPES.find(t => t.value === selectedType)!
    setReports(prev => [{
      id: newId,
      name: `${typeMeta.label} – ${selectedPeriod}`,
      type: selectedType,
      period: selectedPeriod,
      generated: 'Generating…',
      size: '—',
      status: 'generating',
      pages: 0,
    }, ...prev])
    await new Promise(r => setTimeout(r, 2000))
    setReports(prev => prev.map(r =>
      r.id === newId ? { ...r, generated: new Date().toLocaleDateString(), size: '1.4 MB', status: 'ready', pages: 9 } : r
    ))
    setGenerating(false)
    setGenerated(true)
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

          {/* Period + options */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time Period</label>
              <div className="space-y-2">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                      selectedPeriod === p
                        ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={13} />
                      {p}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {generated && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
            <CheckCircle2 size={15} />
            Report generated successfully! It appears in the list below.
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

      {/* Reports list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Generated Reports</h3>
          <span className="text-xs text-gray-500">{reports.filter(r => r.status === 'ready').length} reports available</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-50">
                <th className="text-left px-5 py-3 font-semibold">Report</th>
                <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Period</th>
                <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Generated</th>
                <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Size</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
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
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{report.name}</p>
                        {report.pages > 0 && (
                          <p className="text-[10px] text-gray-400">{report.pages} pages</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-xs text-gray-600">{report.period}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-gray-600">{report.generated}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-gray-600">{report.size}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {report.status === 'ready' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} /> Ready
                      </span>
                    )}
                    {report.status === 'generating' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                        <Clock size={10} className="animate-spin" /> Generating
                      </span>
                    )}
                    {report.status === 'scheduled' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                        <Calendar size={10} /> Scheduled
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {report.status === 'ready' && (
                        <>
                          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Preview">
                            <Eye size={14} />
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                            <Download size={12} /> PDF
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </AdminLayout>
  )
}
