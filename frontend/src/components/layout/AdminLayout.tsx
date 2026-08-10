import React from 'react'
import AdminSidebar from './AdminSidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {(title || subtitle) && (
          <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
            <div>
              {title    && <h1 className="text-xl font-bold text-gray-900 leading-tight">{title}</h1>}
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </header>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
