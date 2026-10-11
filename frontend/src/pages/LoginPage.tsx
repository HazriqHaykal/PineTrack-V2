import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../services/api'
import { authService } from '../services/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await apiClient.login(username, password)
      authService.setTokens(tokens)
      navigate(tokens.user.role === 'admin' ? '/dashboard' : '/my-tasks')
    } catch (err: any) {
      setError(
        err.response?.status === 401
          ? 'Incorrect username or password.'
          : apiErrorMessage(err, 'Sign in failed. Please try again.')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left: background image panel ── */}
      <div
        className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          backgroundImage: 'url(/BackgroundLogin.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />

        {/* Brand — glassy pill */}
        <div
          className="relative z-10 flex items-center w-fit px-4 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <p className="font-logo font-bold text-xl leading-none tracking-tight">
            <span className="text-white">PINE</span><span style={{ color: '#f5922a' }}>TRACK. v2</span>
          </p>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="font-display text-[3rem] leading-[1.1] text-white mb-4">
            From Harvest<br />
            to Delivery.<br />
            <span style={{ color: '#f7bf70' }}>Tracked.</span>
          </h1>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
            PineTrack is a web-based post-harvest management system designed to connect and track the entire pineapple journey, from harvest and grading to transportation and delivery, all in one platform.
          </p>
        </div>

        {/* What the system covers — glassy cards */}
        <div className="relative z-10 flex gap-3">
          {[
            { value: 'Harvest',   label: 'Batches, grading and yield' },
            { value: 'Transport', label: 'Deliveries tracked to arrival' },
            { value: 'Waste',     label: 'Losses logged and reduced' },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex-1 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <p className="font-display text-xl text-white leading-none">{stat.value}</p>
              <p className="text-[11px] mt-1.5 leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <p className="font-logo font-bold text-2xl leading-none tracking-tight mb-6">
              <span style={{ color: '#162f25' }}>PINE</span><span style={{ color: '#f5922a' }}>TRACK. v2</span>
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-8">Sign in to your account to continue</p>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60 text-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-green-600 hover:text-green-700 font-semibold">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

