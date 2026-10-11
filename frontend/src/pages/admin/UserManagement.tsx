import { useEffect, useState } from 'react'
import { Users, Search, Plus, MoreVertical, CheckCircle2, XCircle, Shield, UserCircle, Mail, AlertTriangle } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { apiClient, apiErrorMessage } from '../../services/api'
import { authService } from '../../services/auth'
import { SystemUser } from '../../types'

type UserRole = 'admin' | 'worker'

const EMPTY_FORM = { full_name: '', username: '', email: '', password: '', role: 'worker' as UserRole }

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

export default function UserManagement() {
  const currentUser = authService.getUser()
  const [users, setUsers]     = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | UserRole>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]       = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [saving, setSaving]   = useState(false)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [resetFor, setResetFor] = useState<SystemUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = async () => {
    try {
      const data = await apiClient.listUsers()
      setUsers(data.items)
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to load users'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = (u.full_name || '').toLowerCase().includes(q) ||
                        u.username.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || u.role === filter
    return matchSearch && matchFilter
  })

  const update = async (user: SystemUser, changes: { role?: string; is_active?: boolean }, done: string) => {
    setOpenMenu(null)
    try {
      await apiClient.updateUser(user.id, changes)
      showToast(done, 'success')
      load()
    } catch (err) {
      showToast(apiErrorMessage(err, 'Update failed'), 'error')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await apiClient.createUser(form)
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      showToast('User created', 'success')
      load()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create user.'))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetFor) return
    setSaving(true)
    try {
      await apiClient.updateUser(resetFor.id, { password: newPassword })
      showToast(`Password changed for ${resetFor.username}`, 'success')
      setResetFor(null)
      setNewPassword('')
    } catch (err) {
      showToast(apiErrorMessage(err, 'Password change failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const admins   = users.filter(u => u.role === 'admin' && u.is_active).length
  const workers  = users.filter(u => u.role === 'worker' && u.is_active).length
  const inactive = users.filter(u => !u.is_active).length

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide'

  return (
    <AdminLayout title="User Management" subtitle="Manage team members and access">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active Workers', value: workers,  icon: <Users size={18} />,   color: 'text-green-600 bg-green-50' },
          { label: 'Administrators', value: admins,   icon: <Shield size={18} />,  color: 'text-blue-600 bg-blue-50'  },
          { label: 'Deactivated',    value: inactive, icon: <XCircle size={18} />, color: 'text-gray-500 bg-gray-100' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {(['all', 'admin', 'worker'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                  filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setFormError(''); setShowCreate(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={15} /> Add User
          </button>
        </div>

        {/* User table */}
        <div className="overflow-x-auto min-h-[16rem]">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-50">
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Role</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Tasks Done</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Joined</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shrink-0">
                          <UserCircle size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {u.full_name || u.username}
                            {isSelf && <span className="ml-1.5 text-[10px] text-gray-400 font-normal">(you)</span>}
                          </p>
                          <div className="flex items-center gap-1">
                            <Mail size={10} className="text-gray-400" />
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? <Shield size={10} /> : <UserCircle size={10} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.is_active
                          ? <CheckCircle2 size={12} className="text-green-600" />
                          : <XCircle size={12} className="text-gray-400" />}
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-sm font-semibold text-gray-700">{u.tasks_completed}</span>
                      <span className="text-xs text-gray-400"> / {u.tasks_total}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(u.created_at)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenu === u.id && (
                        <div className="absolute right-4 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-48 py-1 text-left">
                          {!isSelf && (
                            <button
                              onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? 'Account deactivated' : 'Account activated')}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'} Account
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => update(u, { role: u.role === 'admin' ? 'worker' : 'admin' }, 'Role updated')}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            >
                              Make {u.role === 'admin' ? 'Worker' : 'Admin'}
                            </button>
                          )}
                          <button
                            onClick={() => { setOpenMenu(null); setNewPassword(''); setResetFor(u) }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                          >
                            Change Password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No users match your search</p>
            </div>
          )}
          {loading && <p className="text-center py-12 text-sm text-gray-400">Loading users…</p>}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New User</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Siti Aminah" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Username</label>
                  <input required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    placeholder="siti" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 6 characters" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="worker@example.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['worker', 'admin'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                        form.role === r ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {formError && (
                <p className="flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={13} /> {formError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Change Password</h3>
            <p className="text-xs text-gray-500 mb-4">Set a new password for {resetFor.full_name || resetFor.username}.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input required minLength={6} type="password" autoFocus value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 characters)" className={inputClass} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setResetFor(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

    </AdminLayout>
  )
}
