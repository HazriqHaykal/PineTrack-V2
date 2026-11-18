import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Sprout, PackageCheck, Sparkles } from 'lucide-react'
import { apiClient, apiErrorMessage } from '../services/api'
import { authService } from '../services/auth'

import { tr } from '../i18n'
import LanguageToggle from '../components/ui/LanguageToggle'
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
          ? tr("Incorrect username or password.")
          : apiErrorMessage(err, tr("Sign in failed. Please try again."))
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
            <span className="text-white">{tr("PINE")}</span><span style={{ color: '#f5922a' }}>{tr("TRACK. v2")}</span>
          </p>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="font-display text-[2.5rem] xl:text-[3rem] leading-[1.1] text-white mb-5">
            {tr("From Planting")}<br />
            {tr("to Profit.")}<br />
            <span style={{ color: '#f7bf70' }}>{tr("Everything Tracked.")}</span>
          </h1>
          <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {tr("PineTrack V2 is an intelligent pineapple farm management platform that connects planting material inventory, post-harvest operations, and AI-powered insights—all in one seamless system.")}
          </p>
        </div>

        {/* What the system covers — glassy cards */}
        <div className="relative z-10 flex gap-3">
          {[
            { icon: Sprout,     value: tr("Sulur Inventory"), label: tr("Track planting stock, movements, and profitability.") },
            { icon: PackageCheck, value: 'Post-Harvest',  label: tr("Manage grading, deliveries, and waste.") },
            { icon: Sparkles,   value: tr("Smart Insights"),  label: tr("Make better decisions with AI and analytics.") },
          ].map(stat => (
            <div
              key={stat.value}
              className="flex-1 min-w-0 px-4 py-3.5 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <stat.icon size={16} strokeWidth={2} style={{ color: '#f7bf70' }} />
              <p className="font-display text-base xl:text-lg text-white leading-tight mt-2">{stat.value}</p>
              <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-3"><LanguageToggle /></div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <p className="font-logo font-bold text-2xl leading-none tracking-tight mb-6">
              <span style={{ color: '#162f25' }}>{tr("PINE")}</span><span style={{ color: '#f5922a' }}>{tr("TRACK. v2")}</span>
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{tr("Welcome back")}</h2>
            <p className="text-gray-500 text-sm mb-8">{tr("Sign in to your account to continue")}</p>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{tr("Username")}</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  placeholder={tr("Enter your username")}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{tr("Password")}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder={tr("Enter your password")}
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
                    {tr("Signing in…")}
                  </span>
                ) : tr("Sign In")}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              {tr("Don't have an account?")}{' '}
              <Link to="/register" className="text-green-600 hover:text-green-700 font-semibold">
                {tr("Register")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

