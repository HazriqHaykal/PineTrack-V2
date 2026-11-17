import React from 'react'
import WorkerNav from './WorkerNav'

interface WorkerLayoutProps {
  children: React.ReactNode
}

/**
 * Bottom padding keeps the last card clear of the fixed bottom tab bar
 * (64 px + 12 px breathing room + the device's safe-area inset).
 */
export const BOTTOM_NAV_CLEARANCE = 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] xl:pb-0'

export default function WorkerLayout({ children }: WorkerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 xl:flex">
      <WorkerNav />
      <main className={`flex-1 min-w-0 overflow-x-hidden ${BOTTOM_NAV_CLEARANCE}`}>
        {children}
      </main>
    </div>
  )
}
