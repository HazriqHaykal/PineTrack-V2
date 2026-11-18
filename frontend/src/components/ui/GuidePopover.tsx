import { useEffect, useRef, useState } from 'react'
import { Info, X } from 'lucide-react'

import { tr } from '../../i18n'
export interface GuideSection {
  heading: string
  items: { key: string; dot: string; label: string; meaning: string }[]
}

/** Compact "Status guide" button + popover explaining what badge colours mean */
export default function GuidePopover({ title = tr("Status guide"), sections }: { title?: string; sections: GuideSection[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${
          open ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Info size={15} strokeWidth={1.75} /> {title}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <button onClick={() => setOpen(false)} aria-label={tr("Close {0}", title.toLowerCase())}
              className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800">
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          {sections.map((section, i) => (
            <div key={section.heading} className={i > 0 ? 'mt-4' : ''}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{section.heading}</p>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${item.dot}`} aria-hidden />
                    <span className="w-20 shrink-0 font-medium text-gray-900">{item.label}</span>
                    <span className="text-gray-600">{item.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
