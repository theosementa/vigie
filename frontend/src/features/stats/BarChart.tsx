import type { StatsPeriod, TimeseriesGranularity, TimeseriesPoint } from '@/lib/api'
import { niceTicks } from './chartUtils'
import { ChartShell } from './ChartShell'
import { bucketAxisLabel, bucketLongLabel } from './dates'
import { useT } from '@/lib/i18n'
import { formatCount } from './format'
import { ChartDataTable } from './StatsCard'

/** Stacked articles/videos bars per bucket, with the previous period as a grey ghost behind. */
export function BarChart({
  points,
  prev,
  granularity,
  period,
  label,
}: {
  points: TimeseriesPoint[]
  prev?: TimeseriesPoint[]
  granularity: TimeseriesGranularity
  period: StatsPeriod
  label: string
}) {
  const t = useT()
  const rows = points.map((p, i) => ({
    bucket: p.bucket,
    articles: p.articles ?? p.value,
    videos: p.videos ?? 0,
    total: p.value,
    prev: prev?.[i],
  }))
  const max = Math.max(0, ...rows.map((r) => Math.max(r.total, r.prev?.value ?? 0)))
  const { ticks, top } = niceTicks(max)

  return (
    <>
      <ChartShell
        label={label}
        count={rows.length}
        top={top}
        ticks={ticks}
        xLabels={rows.map((r) => bucketAxisLabel(r.bucket, granularity, period))}
        anchorValue={(i) => Math.max(rows[i].total, rows[i].prev?.value ?? 0)}
        tooltip={(i) => {
          const r = rows[i]
          return (
            <div className="space-y-0.5">
              <div className="font-medium capitalize">{bucketLongLabel(r.bucket, granularity)}</div>
              <div>
                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-chart-1" />
                {t('stats.chart.articles', { n: formatCount(r.articles) })}
              </div>
              <div>
                <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-chart-4" />
                {t('stats.chart.videos', { n: formatCount(r.videos) })}
              </div>
              <div className="font-medium">{t('stats.chart.total', { n: formatCount(r.total) })}</div>
              {r.prev && (
                <div className="text-muted-foreground">
                  {t('stats.chart.previous', { n: formatCount(r.prev.value) })}
                </div>
              )}
            </div>
          )
        }}
      >
        {(g, active) =>
          rows.map((r, i) => {
            const bw = Math.min(Math.max(g.band * 0.55, 2), 28)
            const gw = Math.min(g.band * 0.9, bw + 6)
            const x = g.x(i)
            const yArticles = g.y(r.articles)
            const yTotal = g.y(r.articles + r.videos)
            const style = { animationDelay: `${Math.min(i * 12, 400)}ms` }
            return (
              <g key={r.bucket} opacity={active === null || active === i ? 1 : 0.55}>
                {r.prev && r.prev.value > 0 && (
                  <rect
                    x={x - gw / 2}
                    y={g.y(r.prev.value)}
                    width={gw}
                    height={g.base - g.y(r.prev.value)}
                    rx={2}
                    className="fill-muted-foreground/30"
                  />
                )}
                {r.articles > 0 && (
                  <rect
                    x={x - bw / 2}
                    y={yArticles}
                    width={bw}
                    height={g.base - yArticles}
                    rx={1.5}
                    className="bar-grow fill-chart-1"
                    style={style}
                  />
                )}
                {r.videos > 0 && (
                  <rect
                    x={x - bw / 2}
                    y={yTotal}
                    width={bw}
                    height={yArticles - yTotal}
                    rx={1.5}
                    className="bar-grow fill-chart-4"
                    style={style}
                  />
                )}
              </g>
            )
          })
        }
      </ChartShell>
      <ChartDataTable
        caption={label}
        columns={[t('stats.table.period'), t('type.articles'), t('type.videos'), t('stats.table.total'), ...(prev ? [t('stats.previous')] : [])]}
        rows={rows.map((r) => [
          bucketLongLabel(r.bucket, granularity),
          r.articles,
          r.videos,
          r.total,
          ...(prev ? [r.prev?.value ?? '—'] : []),
        ])}
      />
    </>
  )
}
