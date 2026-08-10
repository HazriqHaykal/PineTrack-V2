import { useState } from 'react'
import { Users, Search, Plus, MoreVertical, CheckCircle2, XCircle, Clock, Shield, UserCircle, Mail } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'

type UserRole   = 'admin' | 'worker'
type UserStatus = 'active' | 'inactive' | 'pending'

interface SystemUser {
  id: number
  full_name: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
  joined: string
  last_active: string
  tasks_completed: number
}

const DEMO_USERS: SystemUser[] = [
  { id: 1, full_name: 'Ahmad Razif',    username: 'ahmad.razif',  email: 'ahmad@pinetrack.my',  role: 'admin',  status: 'active',   joined: '2024-01-15', last_active: '2 min ago',   tasks_completed: 0   },
  { id: 2, full_name: 'Ali Hasan',      username: 'ali.hasan',    email: 'ali@pinetrack.my',    role: 'worker', status: 'active',   joined: '2024-02-01', last_active: '1 hour ago',  tasks_completed: 89  },
  { id: 3, full_name: 'Siti Aminah',    username: 'siti.aminah',  email: 'siti@pinetrack.my',   role: 'worker', status: 'active',   joined: '2024-02-14', last_active: '3 hours ago', tasks_completed: 72  },
  { id: 4, full_name: 'Mohd Farid',     username: 'mohd.farid',   email: 'farid@pinetrack.my',  role: 'worker', status: 'active',   joined: '2024-03-05', last_active: 'Yesterday',   tasks_completed: 64  },
  { id: 5, full_name: 'Nurul Ain',      username: 'nurul.ain',    email: 'nurul@pinetrack.my',  role: 'worker', status: 'inactive', joined: '2024-03-20', last_active: '2 days ago',  tasks_completed: 41  },
  { id: 6, full_name: 'Zulkifli Omar',  username: 'zul.omar',     email: 'zul@pinetrack.my',    role: 'worker', status: 'active',   joined: '2024-04-01', last_active: '5 hours ago', tasks_completed: 56  },
  { id: 7, full_name: 'Hafizah Ismail', username: 'hafizah',      email: 'hafizah@pinetrack.my',role: 'worker', status: 'pending',  joined: '2024-05-10', last_active: 'Never',       tasks_completed: 0   },
]

const STATUS_BADGE: Record<UserStatus, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  pending:  'bg-amber-100 text-amber-700',
}

const STATUS_ICON: Record<UserStatus, React.ReactNode> = {
  active:   <CheckCircle2 size={12} className="text-green-600" />,
  inactive: <XCircle      size={12} className="text-gray-400"  />,
  pending:  <Clock        size={12} className="text-amber-500" />,
}

export default function UserManagement() {
  const [users, setUsers]     = useState<SystemUser[]>(DEMO_USERS)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | UserRole>('all')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<UserRole>('worker')
  const [openMenu, setOpenMenu] = useState<number | null>(null)

  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
                        u.username.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || u.role === filter
    return matchSearch && matchFilter
  })

  const toggleStatus = (id: number) => {
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
    ))
    setOpenMenu(null)
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    const newUser: SystemUser = {
      id: users.length + 1,
      full_name: inviteEmail.split('@')[0],
      username:  inviteEmail.split('@')[0].toLowerCase().replace(/\s+/g, '.'),
      email:     inviteEmail,
      role:      inviteRole,
      status:    'pending',
      joined:    new Date().toISOString().split('T')[0],
      last_active: 'Never',
      tasks_completed: 0,
    }
    setUsers(prev => [...prev, newUser])
    setShowInvite(false)
    setInviteEmail('')
  }

  const admins  = users.filter(u => u.role === 'admin' && u.status === 'active').length
  const workers = users.filter(u => u.role === 'worker' && u.status === 'active').length
  const pending = users.filter(u => u.status === 'pending').length

  return (
    <AdminLayout title="User Management" subtitle="Manage team members and access">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active Workers', value: workers, icon: <Users size={18} />, color: 'text-green-600 bg-green-50' },
          { label: 'Administrators', value: admins,  icon: <Shield size={18} />, color: 'text-blue-600 bg-blue-50'  },
          { label: 'Pending Invite', value: pending, icon: <Clock size={18} />,  color: 'text-amber-600 bg-amber-50'},
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
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Plus size={15} /> Invite User
          </button>
        </div>

        {/* User table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-50">
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Role</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Tasks Done</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Last Active</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shrink-0">
                        <UserCircle size={16} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</p>
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
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[u.status]}`}>
                      {STATUS_ICON[u.status]}
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-semibold text-gray-700">{u.tasks_completed}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-gray-500">{u.last_active}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {openMenu === u.id && (
                      <div className="absolute right-4 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1">
                        <button
                          onClick={() => toggleStatus(u.id)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'} Account
                        </button>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">
                          Reset Password
                        </button>
                        <button
                          onClick={() => { setUsers(prev => prev.filter(x => x.id !== u.id)); setOpenMenu(null) }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600"
                        >
                          Remove User
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No users match your search</p>
            </div>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Invite New User</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  placeholder="worker@example.com"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['worker', 'admin'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                        inviteRole === r ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}
