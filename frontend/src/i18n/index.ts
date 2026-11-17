import { ms } from './ms'

/**
 * Lightweight i18n: English text is the key, and `ms` maps it to Bahasa Melayu.
 * Missing entries fall back to English. The language is read once at start-up;
 * switching reloads the page so module-level labels are rebuilt too.
 */
export type Lang = 'en' | 'ms'

const STORAGE_KEY = 'pinetrack_lang'

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ms' ? 'ms' : 'en'
  } catch {
    return 'en'
  }
}

export const lang: Lang = readLang()

/** BCP 47 locale for dates and numbers in the current language */
export const locale = lang === 'ms' ? 'ms-MY' : 'en-MY'

try { document.documentElement.lang = lang } catch { /* not in a browser */ }

/** Translate `text`; `{0}`, `{1}`… are replaced by `args` in order. */
export function tr(text: string, ...args: unknown[]): string {
  const out = lang === 'ms' ? (ms[text] ?? text) : text
  if (!args.length) return out
  return out.replace(/\{(\d+)\}/g, (_, i: string) => {
    const v = args[Number(i)]
    return v === null || v === undefined ? '' : String(v)
  })
}

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ms', label: 'Bahasa Melayu', short: 'BM' },
]

export function setLang(next: Lang) {
  if (next === lang) return
  try { localStorage.setItem(STORAGE_KEY, next) } catch { /* not persisted */ }
  window.location.reload()
}

/** Translate a raw enum value from the API (e.g. "in_transit"), shown as plain words */
export function trEnum(value?: string | null): string {
  if (!value) return ''
  const words = value.replace(/_/g, ' ')
  return ms[words.toLowerCase()] && lang === 'ms' ? ms[words.toLowerCase()] : words
}
