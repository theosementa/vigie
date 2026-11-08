/** Data hooks for the statistics page, backed by the real API (src/lib/api.ts). */
import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMe } from '@/features/auth/useAuth'
import { usePendingDeletes } from '@/features/items/pendingDeletes'
import { addDays, todayIn } from './dates'
import { api, type StatsPeriod, type TimeseriesQuery } from '@/lib/api'

export const statsKey = ['stats'] as const

/** Summary of a period; the previous data stays on screen while navigating. */
export function useStatsSummary(period: StatsPeriod, offset: number) {
  return useQuery({
    queryKey: [...statsKey, 'summary', period, offset],
    queryFn: () => api.stats.summary({ period, offset }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Zero-filled series; pass null to wait for the range (e.g. until the summary is loaded). */
export function useTimeseries(query: TimeseriesQuery | null) {
  return useQuery({
    queryKey: [...statsKey, 'timeseries', query],
    queryFn: () => api.stats.timeseries(query!),
    enabled: query !== null,
    staleTime: 30_000,
  })
}

export type PileState = 'ok' | 'watch' | 'over'

export interface Pile {
  /** Items to watch today, exact. */
  count: number
  /** Change over the last 28 days (negative = the pile shrinks). */
  delta: number
  state: PileState
}

/** Least-squares slope of the series, in items per day. */
function slope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = values.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY)
    den += (x - meanX) ** 2
  })
  return num / den
}

/**
 * The pile (items to watch) over the last 28 days, from the journal (`backlog` series).
 * Trend (VISION 5.4): "tu rattrapes" below -0.1 item/day, "stable" within ±0.1, "ça s'accumule" above.
 */
export function usePile() {
  const { data: me } = useMe()
  const [now] = useState(() => Date.now())
  const to = todayIn(me?.timezone ?? 'UTC', now)
  const pending = usePendingDeletes()
  const query = useTimeseries(me ? { metric: 'backlog', granularity: 'day', from: addDays(to, -27), to } : null)
  const pile = useMemo<Pile | null>(() => {
    const values = query.data?.points.map((p) => p.value)
    if (!values || values.length === 0) return null
    // Items waiting for their Undo toast to end are already gone for the user.
    values[values.length - 1] = Math.max(
      0,
      values[values.length - 1] - [...pending.values()].filter(Boolean).length,
    )
    const s = slope(values)
    return {
      count: values[values.length - 1],
      delta: values[values.length - 1] - values[0],
      state: s < -0.1 ? 'ok' : s > 0.1 ? 'over' : 'watch',
    }
  }, [query.data, pending])
  return { pile, isError: query.isError }
}
