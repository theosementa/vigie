import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { StatsBlock, StatsPeriod } from '@/lib/api'
import { cn } from '@/lib/utils'
import { computeDelta, formatCount, formatMinutes, formatWatchTime, plural } from './format'

const PREVIOUS: Record<StatsPeriod, string> = {
  week: 'semaine précédente',
  month: 'mois précédent',
  year: 'année précédente',
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
  const d = computeDelta(current, previous)
  const versus = `vs ${PREVIOUS[period]}`

  // Nothing to compare with: neutral, never an infinite percentage.
  if (previous === 0) {
    const text = current > 0 ? `+${format(current)}` : 'Aucune activité'
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {current > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : <Minus aria-hidden className="size-3.5" />}
        <span>
          {text} <span className="sr-only">, aucune donnée la {PREVIOUS[period]}</span>
        </span>
      </p>
    )
  }

  const Icon = d.direction === 'up' ? ArrowUp : d.direction === 'down' ? ArrowDown : Minus
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
      <Icon aria-hidden className="size-3.5" />
      <span className="font-medium">
        {d.direction === 'flat' ? 'Stable' : `${sign}${format(Math.abs(d.diff))} (${sign}${Math.abs(d.pct ?? 0)} %)`}
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
    <dl className={cn('rounded-2xl bg-card p-4 ring-1 ring-border', className)}>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-2 text-4xl leading-none font-bold tracking-tight tabular-nums">{value}</dd>
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
  const n = videosWithoutDuration
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:col-span-3 xl:grid-cols-5">
      <MetricCard label="Articles lus" value={formatCount(current.articles_read)}>
        <Delta current={current.articles_read} previous={previous.articles_read} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard label="Vidéos vues" value={formatCount(current.videos_seen)}>
        <Delta current={current.videos_seen} previous={previous.videos_seen} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard label="Ajoutés" value={formatCount(current.items_added)}>
        <Delta current={current.items_added} previous={previous.items_added} format={formatCount} period={period} />
      </MetricCard>
      <MetricCard
        label="Temps de visionnage"
        value={formatWatchTime(current.watch_seconds)}
        note={n > 0 ? `${formatCount(n)} ${plural(n, 'vidéo sans durée exclue', 'vidéos sans durée exclues')}` : undefined}
      >
        <Delta current={current.watch_seconds} previous={previous.watch_seconds} format={formatWatchTime} period={period} />
      </MetricCard>
      <MetricCard label="Temps de lecture" value={formatMinutes(current.reading_minutes)} className="col-span-2 md:col-span-1">
        <Delta current={current.reading_minutes} previous={previous.reading_minutes} format={formatMinutes} period={period} />
      </MetricCard>
    </div>
  )
}
