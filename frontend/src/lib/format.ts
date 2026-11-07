import { getLocale, intlLocale, t, type Locale } from './i18n'

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function formatReadingTime(minutes: number): string {
  return t('format.reading_time', { minutes })
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** ISO datetime -> "5 November 2026" / "5 novembre 2026" */
export function formatDate(iso: string, locale: Locale = getLocale()): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
}

/** ISO datetime -> "5 Nov 2026" / "5 nov. 2026" (year omitted when current year) */
export function formatShortDate(iso: string, locale: Locale = getLocale()): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** ISO datetime -> "5 November 2026 at 10:30" with the locale's own separators. */
export function formatDateTime(iso: string, locale: Locale = getLocale()): string {
  return new Date(iso).toLocaleString(intlLocale(locale), { dateStyle: 'long', timeStyle: 'short' })
}

/** 1234.5 -> "1,234.5" / "1 234,5" */
export function formatNumber(value: number, locale: Locale = getLocale()): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

/** "First Last" for any user-shaped object. */
export function fullName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name}`.trim()
}

/** Up to two initials, for avatars. */
export function initials(u: { first_name: string; last_name: string }): string {
  return `${u.first_name.charAt(0)}${u.last_name.charAt(0)}`.toUpperCase()
}
