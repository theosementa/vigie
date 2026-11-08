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

/** "12 min": reading time in the meta line of a card. */
export function formatMinutesShort(minutes: number): string {
  return t('format.minutes', { minutes })
}

/** 45 -> "45 min", 125 -> "2 h 05", 120 -> "2 h" (non-breaking spaces in French). */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return t('format.minutes', { minutes: rest })
  return rest === 0 ? t('format.hours', { h }) : t('format.hours_minutes', { h, m: String(rest).padStart(2, '0') })
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

/** 4054 -> "4.1k" / "4,1 k": star counts, where the exact figure does not matter. */
export function formatCompact(value: number, locale: Locale = getLocale()): string {
  return new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** "First Last" for any user-shaped object. */
export function fullName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name}`.trim()
}

/** Up to two initials, for avatars. */
export function initials(u: { first_name: string; last_name: string }): string {
  return `${u.first_name.charAt(0)}${u.last_name.charAt(0)}`.toUpperCase()
}

/** "Thursday 5 November" / "jeudi 5 novembre" */
export function formatDayLong(date: Date = new Date(), locale: Locale = getLocale()): string {
  return date.toLocaleDateString(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' })
}

/** ISO datetime -> "today", "yesterday", "3 days ago", then a short date (week-old and older). */
export function formatRelativeDay(iso: string, locale: Locale = getLocale()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(new Date(iso)) - day(new Date())) / 86_400_000)
  if (days < -6) return formatShortDate(iso, locale)
  return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' }).format(Math.min(days, 0), 'day')
}

/** Cut `text` to `max` characters, ending with an ellipsis. */
export function ellipsize(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** ISO datetime -> "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function formatAgo(iso: string, locale: Locale = getLocale()): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' })
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86_400), 'day')
}
