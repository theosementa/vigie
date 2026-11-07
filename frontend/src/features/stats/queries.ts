/** Data hooks for the statistics page, backed by the real API (src/lib/api.ts). */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
