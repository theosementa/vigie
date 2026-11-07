import type { StatsSummary } from '@/lib/api'
import { BarChart } from './BarChart'
import { currentRange, previousRange, rangeLabel } from './dates'
import { useT } from '@/lib/i18n'
import { formatCount } from './format'
import { EmptyNote, ErrorNote, Skeleton, StatsCard } from './StatsCard'
import { useTimeseries } from './queries'

function Legend() {
  const t = useT()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" /> {t('type.articles')}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-4" /> {t('type.videos')}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-muted-foreground/30" /> {t('stats.previous')}
      </li>
    </ul>
  )
}

/** Items seen per bucket (stacked articles/videos) over the previous period as a grey ghost. */
export function HistogramCard({ summary }: { summary: StatsSummary }) {
  const t = useT()
  const { period, start, end } = summary
  const cur = currentRange(period, start, end)
  const prevRange = previousRange(period, start)
  const current = useTimeseries({ metric: 'seen', ...cur })
  // The ghost is optional: if it fails or is slow, the current period still renders.
  const previous = useTimeseries({ metric: 'seen', ...prevRange })

  const total = summary.current.articles_read + summary.current.videos_seen
  const prevPoints = previous.data?.points
  const hasData =
    (current.data?.points.some((p) => p.value > 0) ?? false) || (prevPoints?.some((p) => p.value > 0) ?? false)

  const label = t(cur.granularity === 'month' ? 'stats.histogram.label_month' : 'stats.histogram.label_day', {
    range: rangeLabel(period, start, end),
    total: formatCount(total),
  })

  return (
    <StatsCard title={t('stats.items_seen_title')} className="md:col-span-2">
      {current.isError ? (
        <ErrorNote message={t('stats.histogram.error')} onRetry={() => current.refetch()} />
      ) : !current.data ? (
        <Skeleton className="h-[240px]" />
      ) : (
        <>
          <p className="text-3xl font-medium tabular-nums">
            {formatCount(total)}{' '}
            <span className="text-base font-medium text-muted-foreground">
              {t('stats.items_seen', { count: total })}
            </span>
          </p>
          <div className="mt-2 mb-3">
            <Legend />
          </div>
          {hasData ? (
            <BarChart
              points={current.data.points}
              prev={prevPoints}
              granularity={cur.granularity}
              period={period}
              label={label}
            />
          ) : (
            <EmptyNote>{t('stats.histogram.empty')}</EmptyNote>
          )}
        </>
      )}
    </StatsCard>
  )
}
