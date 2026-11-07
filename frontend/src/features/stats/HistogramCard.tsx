import type { StatsSummary } from '@/lib/api'
import { BarChart } from './BarChart'
import { currentRange, previousRange, rangeLabel } from './dates'
import { formatCount, plural } from './format'
import { EmptyNote, ErrorNote, Skeleton, StatsCard } from './StatsCard'
import { useTimeseries } from './queries'

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" /> Articles
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-4" /> Vidéos
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-muted-foreground/30" /> Période précédente
      </li>
    </ul>
  )
}

/** Items seen per bucket (stacked articles/videos) over the previous period as a grey ghost. */
export function HistogramCard({ summary }: { summary: StatsSummary }) {
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

  const label = `Éléments vus, ${rangeLabel(period, start, end)} : ${formatCount(total)} au total, articles et vidéos par ${
    cur.granularity === 'month' ? 'mois' : 'jour'
  }, comparé à la période précédente.`

  return (
    <StatsCard title="Éléments vus" className="md:col-span-2">
      {current.isError ? (
        <ErrorNote message="Impossible de charger l'histogramme." onRetry={() => current.refetch()} />
      ) : !current.data ? (
        <Skeleton className="h-[240px]" />
      ) : (
        <>
          <p className="text-3xl font-bold tabular-nums">
            {formatCount(total)}{' '}
            <span className="text-base font-medium text-muted-foreground">
              {plural(total, 'élément vu', 'éléments vus')}
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
            <EmptyNote>Aucun élément vu sur cette période ni sur la précédente.</EmptyNote>
          )}
        </>
      )}
    </StatsCard>
  )
}
