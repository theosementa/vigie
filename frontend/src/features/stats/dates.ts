import { getLocale, intlLocale, t } from '@/lib/i18n'
/**
 * Calendar-date helpers. The API speaks "YYYY-MM-DD" in the user's time zone; those are plain
 * calendar dates, so all the arithmetic below is done in UTC to stay independent of the browser zone.
 */
import type { StatsPeriod, TimeseriesGranularity } from '@/lib/api'

const DAY_MS = 86_400_000

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(ymd: string, days: number): string {
  return toYmd(new Date(parseYmd(ymd).getTime() + days * DAY_MS))
}

/** Today's calendar date in the given IANA zone. */
export function todayIn(timeZone: string, now: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
  } catch {
    return toYmd(new Date(now))
  }
}

/** Start of the period before the one starting on `start`. */
export function previousStart(period: StatsPeriod, start: string): string {
  if (period === 'week') return addDays(start, -7)
  const d = parseYmd(start)
  const [y, m] = [d.getUTCFullYear(), d.getUTCMonth()]
  return toYmd(period === 'month' ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(y - 1, 0, 1)))
}

export interface ChartRange {
  from: string
  /** inclusive */
  to: string
  granularity: TimeseriesGranularity
}

/** Items-seen histogram: days for week and month, months for year. */
export function currentRange(period: StatsPeriod, start: string, end: string): ChartRange {
  return { from: start, to: addDays(end, -1), granularity: period === 'year' ? 'month' : 'day' }
}

/** Same granularity over the previous period (shown as the ghost series). */
export function previousRange(period: StatsPeriod, start: string): ChartRange {
  return {
    from: previousStart(period, start),
    to: addDays(start, -1),
    granularity: period === 'year' ? 'month' : 'day',
  }
}

/** Backlog line: daily, weekly over a year; never extends past today (the future is unknown). */
export function backlogRange(period: StatsPeriod, start: string, end: string, today: string): ChartRange {
  const last = addDays(end, -1)
  return { from: start, to: last < today ? last : today, granularity: period === 'year' ? 'week' : 'day' }
}

const formatters = new Map<string, Intl.DateTimeFormat>()
/** A formatter that follows the current UI language (built lazily, cached per language). */
const fmt = (opts: Intl.DateTimeFormatOptions) => ({
  format(d: Date): string {
    const tag = intlLocale(getLocale())
    const key = `${tag}|${JSON.stringify(opts)}`
    let f = formatters.get(key)
    if (!f) {
      f = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...opts })
      formatters.set(key, f)
    }
    return f.format(d)
  },
})

const F = {
  dayShort: fmt({ day: 'numeric', month: 'short' }),
  dayShortYear: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
  dayLong: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  monthYear: fmt({ month: 'long', year: 'numeric' }),
  monthShort: fmt({ month: 'short' }),
  weekdayShort: fmt({ weekday: 'short' }),
  dayNum: fmt({ day: 'numeric' }),
  year: fmt({ year: 'numeric' }),
}

/** "3 – 9 Nov 2026", "November 2026", "2026" */
export function rangeLabel(period: StatsPeriod, start: string, end: string): string {
  const s = parseYmd(start)
  if (period === 'year') return F.year.format(s)
  if (period === 'month') return F.monthYear.format(s)
  const last = parseYmd(addDays(end, -1))
  const sameMonth = s.getUTCMonth() === last.getUTCMonth() && s.getUTCFullYear() === last.getUTCFullYear()
  const from = sameMonth ? F.dayNum.format(s) : F.dayShort.format(s)
  return `${from} – ${F.dayShortYear.format(last)}`
}

/** Short axis label of a bucket. */
export function bucketAxisLabel(bucket: string, granularity: TimeseriesGranularity, period: StatsPeriod): string {
  const d = parseYmd(bucket)
  if (granularity === 'month') return F.monthShort.format(d)
  if (granularity === 'week') return F.dayShort.format(d)
  return period === 'week' ? F.weekdayShort.format(d) : F.dayNum.format(d)
}

/** Full label of a bucket (tooltips, data tables). */
export function bucketLongLabel(bucket: string, granularity: TimeseriesGranularity): string {
  const d = parseYmd(bucket)
  if (granularity === 'month') return F.monthYear.format(d)
  if (granularity === 'week') return t('stats.week_of', { date: F.dayShort.format(d) })
  return F.dayLong.format(d)
}
