const nf = new Intl.NumberFormat('fr-FR')

export function formatCount(n: number): string {
  return nf.format(n)
}

/** 45 -> "45 min", 125 -> "2 h 05", 120 -> "2 h" */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`
}

export function formatWatchTime(seconds: number): string {
  return formatMinutes(seconds / 60)
}

/** French plural: 0 and 1 are singular. */
export function plural(n: number, one: string, many: string): string {
  return n >= 2 ? many : one
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
