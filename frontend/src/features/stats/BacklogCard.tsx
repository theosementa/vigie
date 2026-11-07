import { useState } from 'react'
import type { StatsSummary } from '@/lib/api'
import { AreaChart } from './AreaChart'
import { backlogRange, todayIn } from './dates'
import { computeDelta, formatCount } from './format'
import { EmptyNote, ErrorNote, Skeleton, StatsCard } from './StatsCard'
import { useTimeseries } from './queries'

/** Number of items still "À voir" over the period: am I catching up? */
export function BacklogCard({ summary }: { summary: StatsSummary }) {
  const { period, start, end, timezone } = summary
  const [now] = useState(() => Date.now())
  const range = backlogRange(period, start, end, todayIn(timezone, now))
  const query = useTimeseries({ metric: 'backlog', ...range })
  const points = query.data?.points ?? []

  let trend = null
  if (points.length > 1) {
    const d = computeDelta(points[points.length - 1].value, points[0].value)
    trend =
      d.direction === 'down'
        ? `−${formatCount(-d.diff)} sur la période : vous rattrapez votre retard`
        : d.direction === 'up'
          ? `+${formatCount(d.diff)} sur la période : le backlog grossit`
          : 'Stable sur la période'
  }

  return (
    <StatsCard title="Tendance du backlog" className="md:col-span-2 xl:col-span-3">
      {query.isError ? (
        <ErrorNote message="Impossible de charger la tendance." onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="h-[240px]" />
      ) : points.length === 0 ? (
        <EmptyNote>Pas de données pour cette période.</EmptyNote>
      ) : (
        <>
          <p className="text-3xl font-bold tabular-nums">
            {formatCount(points[points.length - 1].value)}{' '}
            <span className="text-base font-medium text-muted-foreground">à voir</span>
          </p>
          {trend && <p className="mt-1 mb-3 text-sm text-muted-foreground">{trend}</p>}
          <AreaChart
            points={points}
            granularity={range.granularity}
            period={period}
            valueLabel="Éléments à voir"
            label={`Tendance du backlog : ${formatCount(points[0].value)} éléments à voir au début, ${formatCount(
              points[points.length - 1].value,
            )} à la fin de la période.`}
          />
        </>
      )}
    </StatsCard>
  )
}
