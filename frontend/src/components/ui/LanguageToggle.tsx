import { Languages } from 'lucide-react'
import { LANGUAGES, lang, setLang, tr } from '../../i18n'

/** EN | BM switch. Changing the language reloads the page in the new language. */
export default function LanguageToggle({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  return (
    <div
      role="group"
      aria-label={tr('Language')}
      className={`inline-flex items-center gap-1 rounded-lg p-0.5 text-[11px] font-semibold ${
        dark ? 'bg-white/[0.06]' : 'bg-gray-100'
      }`}
    >
      {!compact && <Languages size={13} className={`mx-1 ${dark ? 'text-[#8ac5a8]' : 'text-gray-500'}`} aria-hidden />}
      {LANGUAGES.map((l) => {
        const active = l.code === lang
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            title={l.label}
            className={`rounded-md px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f29b38]/70 ${
              active
                ? dark ? 'bg-[rgba(212,129,58,0.25)] text-[#f7bf70]' : 'bg-white text-green-800 shadow-sm'
                : dark ? 'text-[#8ac5a8] hover:text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {l.short}
          </button>
        )
      })}
    </div>
  )
}
