import React from 'react'
import AdminSidebar from './AdminSidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  /** Buttons shown on the right of the title row */
  actions?: React.ReactNode
}

/**
 * Admin page shell. Owns the page padding, so pages never add their own outer
 * padding. Pages either pass `title`/`subtitle` or render the same header
 * themselves with <AdminPageHeader>, so every admin page starts identically.
 */
export default function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {title && <AdminPageHeader title={title} subtitle={subtitle} actions={actions} />}
          {children}
        </div>
      </main>
    </div>
  )
}

export function AdminPageHeader({ title, subtitle, actions }: {
  title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">{actions}</div>}
    </div>
  )
}
