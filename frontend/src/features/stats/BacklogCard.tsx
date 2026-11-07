import { useState } from 'react'
import type { StatsSummary } from '@/lib/api'
import { AreaChart } from './AreaChart'
import { backlogRange, todayIn } from './dates'
import { useT } from '@/lib/i18n'
import { computeDelta, formatCount } from './format'
import { EmptyNote, ErrorNote, Skeleton, StatsCard } from './StatsCard'
import { useTimeseries } from './queries'

/** Number of items still "À voir" over the period: am I catching up? */
export function BacklogCard({ summary }: { summary: StatsSummary }) {
  const t = useT()
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
        ? t('stats.backlog.down', { n: formatCount(-d.diff) })
        : d.direction === 'up'
          ? t('stats.backlog.up', { n: formatCount(d.diff) })
          : t('stats.backlog.flat')
  }

  return (
    <StatsCard title={t('stats.backlog')} className="md:col-span-2 xl:col-span-3">
      {query.isError ? (
        <ErrorNote message={t('stats.backlog.error')} onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="h-[240px]" />
      ) : points.length === 0 ? (
        <EmptyNote>{t('stats.backlog.empty')}</EmptyNote>
      ) : (
        <>
          <p className="text-3xl font-medium tabular-nums">
            {formatCount(points[points.length - 1].value)}{' '}
            <span className="text-base font-medium text-muted-foreground">{t('filters.to_watch')}</span>
          </p>
          {trend && <p className="mt-1 mb-3 text-sm text-muted-foreground">{trend}</p>}
          <AreaChart
            points={points}
            granularity={range.granularity}
            period={period}
            valueLabel={t('stats.backlog.value')}
            label={t('stats.backlog.label', {
              start: formatCount(points[0].value),
              end: formatCount(points[points.length - 1].value),
            })}
          />
        </>
      )}
    </StatsCard>
  )
}
