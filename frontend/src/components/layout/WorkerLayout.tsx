import React from 'react'
import WorkerNav from './WorkerNav'

interface WorkerLayoutProps {
  children: React.ReactNode
}

export default function WorkerLayout({ children }: WorkerLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <WorkerNav />
      {/* pb-20 on mobile for bottom tab bar clearance */}
      <main className="flex-1 overflow-auto min-w-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
