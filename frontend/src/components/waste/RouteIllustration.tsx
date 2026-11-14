import { RecoveryRoute } from '../../types'

/**
 * Small line illustrations, one per recovery route. Inline SVG so they need no
 * asset pipeline, inherit the tint colour, and stay crisp at any size.
 */
const TINT: Record<RecoveryRoute, string> = {
  compost:    'bg-green-50 text-green-700',
  feed:       'bg-teal-50 text-teal-700',
  processing: 'bg-amber-50 text-amber-700',
  low_grade:  'bg-orange-50 text-orange-700',
  dispose:    'bg-gray-100 text-gray-600',
  review:     'bg-gray-100 text-gray-500',
}

function Art({ route }: { route: RecoveryRoute }) {
  switch (route) {
    case 'compost':
      return (
        <>
          <path d="M8 50h48" />
          <path d="M12 50c3-10 11-16 20-16s17 6 20 16" />
          <path d="M20 44h4M30 40h3M38 45h5M27 47h3" opacity=".6" />
          <path d="M32 34V20" />
          <path d="M32 26c-6 0-10-4-10-9 6 0 10 4 10 9z" />
          <path d="M32 22c5 0 9-3 9-8-5 0-9 3-9 8z" />
        </>
      )
    case 'feed':
      return (
        <>
          <path d="M10 38h44l-5 12H15z" />
          <path d="M14 44h36" opacity=".6" />
          <path d="M26 38c0-6 2-10 6-14 4 4 6 8 6 14" />
          <path d="M32 24v-10M32 18l-6-6M32 18l6-6M28 26l-6-4M36 26l6-4" />
        </>
      )
    case 'processing':
      return (
        <>
          <path d="M20 22h20l-3 30H23z" />
          <path d="M21.5 32h17" opacity=".6" />
          <path d="M34 22l4-10h6" />
          <circle cx="44" cy="24" r="7" />
          <path d="M44 17v14M37 24h14" opacity=".6" />
        </>
      )
    case 'low_grade':
      return (
        <>
          <rect x="12" y="30" width="40" height="20" rx="2" />
          <path d="M12 38h40M24 30v20M40 30v20" opacity=".6" />
          <path d="M22 26l4-6 4 6M34 24l4-6 4 6" />
        </>
      )
    case 'dispose':
      return (
        <>
          <path d="M18 20h28M26 20v-4h12v4" />
          <path d="M21 20l2 32h18l2-32" />
          <path d="M28 27v18M36 27v18" opacity=".6" />
        </>
      )
    default:
      return (
        <>
          <rect x="18" y="14" width="28" height="38" rx="3" />
          <path d="M26 14v-2h12v2" />
          <path d="M28 28c0-3 2-5 4-5s4 2 4 4c0 3-4 3-4 7" />
          <path d="M32 41v.5" />
        </>
      )
  }
}

export default function RouteIllustration({ route, size = 'md' }: { route: RecoveryRoute; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-12 w-12' : 'h-20 w-20'
  return (
    <div className={`${box} ${TINT[route]} shrink-0 rounded-xl flex items-center justify-center`} aria-hidden>
      <svg viewBox="0 0 64 64" className="h-4/5 w-4/5" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round">
        <Art route={route} />
      </svg>
    </div>
  )
}
