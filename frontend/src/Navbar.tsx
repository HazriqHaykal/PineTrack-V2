// Legacy navbar — replaced by components/layout/Sidebar.tsx
// Kept for backwards compatibility
import { useNavigate } from 'react-router-dom'
import { authService } from './services/auth'

export default function Navbar() {
  const navigate = useNavigate()
  const user = authService.getUser()

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <nav className="bg-green-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <button onClick={() => navigate('/dashboard')} className="text-2xl font-bold">
          PineTrack
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.full_name || user?.username}</span>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
