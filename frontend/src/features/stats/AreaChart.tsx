import { useId } from 'react'
import type { TimeseriesGranularity, TimeseriesPoint } from '@/lib/api'
import { niceTicks } from './chartUtils'
import { ChartShell } from './ChartShell'
import { bucketAxisLabel, bucketLongLabel } from './dates'
import type { StatsPeriod } from '@/lib/api'
import { formatCount } from './format'
import { ChartDataTable } from './StatsCard'

/** Line + area of a single count series (backlog trend). */
export function AreaChart({
  points,
  granularity,
  period,
  label,
  valueLabel,
}: {
  points: TimeseriesPoint[]
  granularity: TimeseriesGranularity
  period: StatsPeriod
  label: string
  /** Column / tooltip name of the series */
  valueLabel: string
}) {
  const gradientId = `area-${useId().replace(/:/g, '')}`
  const max = Math.max(0, ...points.map((p) => p.value))
  const { ticks, top } = niceTicks(max)

  return (
    <>
      <ChartShell
        label={label}
        count={points.length}
        top={top}
        ticks={ticks}
        height={180}
        xLabels={points.map((p) => bucketAxisLabel(p.bucket, granularity, period))}
        anchorValue={(i) => points[i].value}
        tooltip={(i) => (
          <div className="space-y-0.5">
            <div className="font-semibold capitalize">{bucketLongLabel(points[i].bucket, granularity)}</div>
            <div>
              {valueLabel} : {formatCount(points[i].value)}
            </div>
          </div>
        )}
      >
        {(g, active) => {
          const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${g.x(i)},${g.y(p.value)}`).join(' ')
          const area = `${line} L${g.x(points.length - 1)},${g.base} L${g.x(0)},${g.base} Z`
          return (
            <g>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {points.length > 1 && (
                <>
                  <path d={area} fill={`url(#${gradientId})`} />
                  <path
                    d={line}
                    fill="none"
                    className="stroke-chart-1"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              )}
              {(points.length === 1 || active !== null) && (
                <circle
                  cx={g.x(active ?? 0)}
                  cy={g.y(points[active ?? 0].value)}
                  r={4.5}
                  className="fill-chart-1 stroke-card"
                  strokeWidth={2}
                />
              )}
            </g>
          )
        }}
      </ChartShell>
      <ChartDataTable
        caption={label}
        columns={['Période', valueLabel]}
        rows={points.map((p) => [bucketLongLabel(p.bucket, granularity), p.value])}
      />
    </>
  )
}
