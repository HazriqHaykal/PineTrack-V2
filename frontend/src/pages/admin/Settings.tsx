import { useState, useEffect } from 'react'
import { Settings, Bell, Database, Save, CheckCircle2, Target } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage, saveBlob } from '../../services/api'

interface ToggleSetting { id: string; label: string; desc: string; value: boolean }

export default function AdminSettings() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setSaveError('')
    try {
      const blob = await apiClient.exportAllData()
      saveBlob(blob, `pinetrack-export-${new Date().toISOString().split('T')[0]}.zip`)
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Export failed.'))
    } finally {
      setExporting(false)
    }
  }
  const [farmName, setFarmName] = useState('PineTrack Farm')
  const [timezone, setTimezone] = useState('Asia/Kuala_Lumpur')
  const [language, setLanguage] = useState('English')

  const [maxSpoilageRate, setMaxSpoilageRate] = useState('5')
  const [maxRejectionRate, setMaxRejectionRate] = useState('5')
  const [targetsSaving, setTargetsSaving] = useState(false)
  const [targetsSaved, setTargetsSaved] = useState(false)
  const [targetsError, setTargetsError] = useState('')

  useEffect(() => {
    apiClient.getQualityTargets()
      .then(t => {
        setMaxSpoilageRate(String(t.max_spoilage_rate))
        setMaxRejectionRate(String(t.max_rejection_rate))
      })
      .catch((err) => setTargetsError(apiErrorMessage(err, 'Could not load quality targets.')))

    apiClient.getSettings()
      .then(s => {
        setFarmName(s.farm_name)
        setTimezone(s.timezone)
        setLanguage(s.language)
        // Stored toggles override the defaults below; unknown ids are ignored
        setNotifications(prev => prev.map(n => n.id in s.notifications ? { ...n, value: s.notifications[n.id] } : n))
      })
      .catch((err) => setSaveError(apiErrorMessage(err, 'Could not load settings.')))
  }, [])

  const handleSaveTargets = async () => {
    setTargetsSaving(true)
    setTargetsError('')
    try {
      await apiClient.updateQualityTargets({
        max_spoilage_rate: parseFloat(maxSpoilageRate) || 0,
        max_rejection_rate: parseFloat(maxRejectionRate) || 0,
      })
      setTargetsSaved(true)
      setTimeout(() => setTargetsSaved(false), 3000)
    } catch (err) {
      setTargetsError(apiErrorMessage(err, 'Failed to save targets.'))
    } finally {
      setTargetsSaving(false)
    }
  }

  const [notifications, setNotifications] = useState<ToggleSetting[]>([
    { id: 'harvest_alerts',   label: 'Harvest Alerts',      desc: 'Notify when harvest batches are logged',       value: true  },
    { id: 'waste_threshold',  label: 'Waste Threshold',     desc: 'Alert when waste exceeds 5% of harvest',      value: true  },
    { id: 'ai_insights',      label: 'Agent Recommendations', desc: 'Notify when PineTrack Agent has new recommendations',      value: true  },
    { id: 'transport_delay',  label: 'Transport Delays',    desc: 'Alert when deliveries are overdue',           value: false },
    { id: 'weekly_report',    label: 'Weekly Reports',      desc: 'Auto-generate reports every Monday',          value: true  },
  ])

  const toggle = (
    setList: React.Dispatch<React.SetStateAction<ToggleSetting[]>>,
    id: string
  ) => {
    setList(prev => prev.map(s => s.id === id ? { ...s, value: !s.value } : s))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await apiClient.updateSettings({
        farm_name: farmName,
        timezone,
        language,
        notifications: Object.fromEntries(notifications.map(n => [n.id, n.value])),
        security: {},
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to save settings.'))
    } finally {
      setSaving(false)
    }
  }

  const ToggleRow = ({ item, onToggle }: { item: ToggleSetting; onToggle: () => void }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900">{item.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          item.value ? 'bg-green-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          item.value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )

  return (
    <AdminLayout title="Settings" subtitle="System configuration and preferences">

      {/* Save bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 active:scale-[0.98] transition-all shadow-md shadow-green-100 disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
            <CheckCircle2 size={16} /> Settings saved!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-6">

          {/* General settings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Settings size={15} className="text-slate-600" />
              <h3 className="text-sm font-bold text-gray-900">General</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Farm / Organisation Name</label>
                <input
                  value={farmName}
                  onChange={e => setFarmName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Timezone</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option>Asia/Kuala_Lumpur</option>
                    <option>Asia/Singapore</option>
                    <option>UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option>English</option>
                    <option>Bahasa Melayu</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Quality targets */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Target size={15} className="text-slate-600" />
              <h3 className="text-sm font-bold text-gray-900">Quality Targets</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 -mt-1">
                Maximum acceptable spoilage and rejection rates for harvest batches. The Harvest module flags any batch exceeding these thresholds.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Max Spoilage Rate (%)</label>
                  <input
                    type="number"
                    min="0" max="100" step="0.1"
                    value={maxSpoilageRate}
                    onChange={e => setMaxSpoilageRate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Max Rejection Rate (%)</label>
                  <input
                    type="number"
                    min="0" max="100" step="0.1"
                    value={maxRejectionRate}
                    onChange={e => setMaxRejectionRate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              {targetsError && <p className="text-xs text-red-600">{targetsError}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveTargets}
                  disabled={targetsSaving}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {targetsSaving ? 'Saving…' : 'Save Targets'}
                </button>
                {targetsSaved && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                    <CheckCircle2 size={14} /> Saved
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data management */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Database size={15} className="text-slate-600" />
              <h3 className="text-sm font-bold text-gray-900">Data Management</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Export All Data</p>
                  <p className="text-xs text-gray-500">Download every table as CSV files in one zip</p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Bell size={15} className="text-slate-600" />
              <h3 className="text-sm font-bold text-gray-900">Notification Preferences</h3>
            </div>
            <div className="px-5">
              <p className="text-xs text-gray-500 pt-4">
                Saved with your settings. Alerts currently appear on the dashboard; email and push delivery is not set up.
              </p>
              {notifications.map(item => (
                <ToggleRow key={item.id} item={item} onToggle={() => toggle(setNotifications, item.id)} />
              ))}
            </div>
          </div>

        </div>

      </div>

    </AdminLayout>
  )
}
