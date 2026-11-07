import type { StatsBlock, StatsPeriod } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { computeDelta, formatCount, formatMinutes, formatWatchTime } from './format'

const VERSUS: Record<StatsPeriod, MessageKey> = {
  week: 'stats.versus.week',
  month: 'stats.versus.month',
  year: 'stats.versus.year',
}

function Delta({
  current,
  previous,
  format,
  period,
}: {
  current: number
  previous: number
  format: (n: number) => string
  period: StatsPeriod
}) {
  const t = useT()
  const d = computeDelta(current, previous)
  const versus = t(VERSUS[period])

  // Nothing to compare with: neutral, never an infinite percentage.
  if (previous === 0) {
    const text = current > 0 ? `+${format(current)}` : t('stats.no_activity')
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {current > 0 ? <Icon name="arrow-up" className="size-3.5" /> : <Icon name="minus" className="size-3.5" />}
        <span>
          {text} <span className="sr-only">, {t('stats.no_previous')}</span>
        </span>
      </p>
    )
  }

  const arrow = d.direction === 'up' ? 'arrow-up' : d.direction === 'down' ? 'arrow-down' : 'minus'
  const sign = d.direction === 'up' ? '+' : d.direction === 'down' ? '−' : ''
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-1 text-xs',
        d.direction === 'up' && 'text-chart-2',
        d.direction === 'down' && 'text-chart-3',
        d.direction === 'flat' && 'text-muted-foreground',
      )}
    >
      <Icon name={arrow} className="size-3.5" />
      <span className="font-medium">
        {d.direction === 'flat' ? t('stats.flat') : `${sign}${format(Math.abs(d.diff))} (${sign}${Math.abs(d.pct ?? 0)} %)`}
      </span>
      <span className="text-muted-foreground">{versus}</span>
    </p>
  )
}

function MetricCard({
  label,
  value,
  note,
  className,
  children,
}: {
  label: string
  value: string
  note?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <dl className={cn('panel', className)}>
      <dt className="h-label">{label}</dt>
      <dd className="mt-2 text-4xl leading-none font-medium tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-2">{children}</dd>
      {note && <dd className="mt-1.5 text-xs text-muted-foreground">{note}</dd>}
    </dl>
  )
}

/** Big numbers with their delta against the previous period. */
export function MetricCards({
  current,
  previous,
  period,
  videosWithoutDuration,
}: {
  current: StatsBlock
  previous: StatsBlock
  period: StatsPeriod
  videosWithoutDuration: number
}) {
  const t = useT()
  const n = videosWithoutDuration
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:col-span-3 xl:grid-cols-5">
      <MetricCard label={t('stats.articles_read')} value={formatCount(current.articles_read)}>
        <Delta current={current.articles_read} previous={previous.articles_read} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard label={t('stats.videos_seen')} value={formatCount(current.videos_seen)}>
        <Delta current={current.videos_seen} previous={previous.videos_seen} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard label={t('stats.added')} value={formatCount(current.items_added)}>
        <Delta current={current.items_added} previous={previous.items_added} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard
        label={t('stats.watch_time')}
        value={formatWatchTime(current.watch_seconds)}
        note={n > 0 ? t('stats.excluded', { count: n, formatted: formatCount(n) }) : undefined}
      >
        <Delta current={current.watch_seconds} previous={previous.watch_seconds} format={formatWatchTime} period={period} />
      </MetricCard>
      <MetricCard label={t('stats.reading_time')} value={formatMinutes(current.reading_minutes)} className="col-span-2 md:col-span-1">
        <Delta current={current.reading_minutes} previous={previous.reading_minutes} format={formatMinutes} period={period} />
      </MetricCard>
    </div>
  )
}
