import { formatMinutes, formatNumber } from '@/lib/format'

export { formatMinutes }

export function formatCount(n: number): string {
  return formatNumber(n)
}

export function formatWatchTime(seconds: number): string {
  return formatMinutes(seconds / 60)
}

export interface Delta {
  diff: number
  /** Percent change, or null when there is no previous value to compare to. */
  pct: number | null
  direction: 'up' | 'down' | 'flat'
}

export function computeDelta(current: number, previous: number): Delta {
  const diff = current - previous
  return {
    diff,
    pct: previous > 0 ? Math.round((diff / previous) * 100) : null,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  }
}
