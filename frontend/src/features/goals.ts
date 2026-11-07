import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { StatsPeriod } from '@/lib/api'

export interface Goals {
  /** Items seen */
  items: number
  /** Minutes of video watched */
  minutes: number
}

export const DEFAULT_GOALS: Record<StatsPeriod, Goals> = {
  week: { items: 5, minutes: 120 },
  month: { items: 20, minutes: 480 },
  year: { items: 250, minutes: 6000 },
}

const KEY = 'radar.stats.goals'
const listeners = new Set<() => void>()
/** Fallback when localStorage is unavailable, so edits still work for the session. */
let memoryRaw: string | null = null

function readRaw(): string {
  if (memoryRaw !== null) return memoryRaw
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function clampInt(v: unknown, fallback: number, max: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback
}

function parse(raw: string): Partial<Record<StatsPeriod, Partial<Goals>>> {
  try {
    const data: unknown = raw ? JSON.parse(raw) : {}
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

/** Goals of a period, persisted per period in localStorage. */
export function useGoals(period: StatsPeriod) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => '')
  const goals = useMemo<Goals>(() => {
    const stored = parse(raw)[period]
    const d = DEFAULT_GOALS[period]
    return { items: clampInt(stored?.items, d.items, 9999), minutes: clampInt(stored?.minutes, d.minutes, 99999) }
  }, [raw, period])

  const setGoals = useCallback(
    (next: Goals) => {
      const all = parse(readRaw())
      all[period] = {
        items: clampInt(next.items, DEFAULT_GOALS[period].items, 9999),
        minutes: clampInt(next.minutes, DEFAULT_GOALS[period].minutes, 99999),
      }
      const json = JSON.stringify(all)
      memoryRaw = json
      try {
        localStorage.setItem(KEY, json)
      } catch {
        // kept in memory only
      }
      listeners.forEach((l) => l())
    },
    [period],
  )

  return { goals, setGoals }
}
