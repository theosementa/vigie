import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import type { StatsPeriod, StatsSummary } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BacklogCard } from './BacklogCard'
import { rangeLabel } from './dates'
import { HistogramCard } from './HistogramCard'
import { MetricCards } from './MetricCards'
import { PeriodNav } from './PeriodNav'
import { TopSourcesCard, TopTagsCard } from './RankedCards'
import { useStatsSummary } from './queries'
import { RingsCard } from './RingsCard'
import { SharesCard } from './SharesCard'
import { EmptyNote, ErrorNote, Skeleton } from './StatsCard'

const MAX_BACK = 520

function parsePeriod(v: string | null): StatsPeriod {
  return v === 'month' || v === 'year' ? v : 'week'
}

function parseOffset(v: string | null): number {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(0, Math.max(n, -MAX_BACK)) : 0
}

const GRID = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'

function StatsSkeleton() {
  const t = useT()
  return (
    <div role="status" aria-label={t('common.loading')} className={GRID}>
      <Skeleton className="h-[330px] md:col-span-2 xl:col-span-1" />
      <Skeleton className="h-[330px] md:col-span-2" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:col-span-3 xl:grid-cols-5 md:col-span-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={cn('h-[120px]', i === 4 && 'col-span-2 md:col-span-1')} />
        ))}
      </div>
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[200px] md:col-span-2 xl:col-span-1" />
      <Skeleton className="h-[300px] md:col-span-2 xl:col-span-3" />
    </div>
  )
}

function isEmpty(s: StatsSummary): boolean {
  const zero = (b: StatsSummary['current']) =>
    b.articles_read + b.videos_seen + b.items_added === 0
  return (
    zero(s.current) &&
    zero(s.previous) &&
    s.shares.sent + s.shares.received === 0 &&
    s.streak.best === 0
  )
}

function StatsContent({ summary }: { summary: StatsSummary }) {
  const t = useT()
  if (isEmpty(summary))
    return (
      <div className="panel">
        <EmptyNote>{t('stats.empty')}</EmptyNote>
      </div>
    )
  return (
    <div className={GRID}>
      <RingsCard summary={summary} />
      <HistogramCard summary={summary} />
      <MetricCards
        current={summary.current}
        previous={summary.previous}
        period={summary.period}
        videosWithoutDuration={summary.videos_without_duration}
      />
      <TopTagsCard tags={summary.top_tags} />
      <TopSourcesCard sources={summary.top_sources} />
      <SharesCard shares={summary.shares} />
      <BacklogCard summary={summary} />
    </div>
  )
}

export function StatsPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const period = parsePeriod(params.get('period'))
  const offset = parseOffset(params.get('offset'))
  const query = useStatsSummary(period, offset)
  const summary = query.data

  const navigate = (nextPeriod: StatsPeriod, nextOffset: number) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (nextPeriod === 'week') next.delete('period')
        else next.set('period', nextPeriod)
        if (nextOffset === 0) next.delete('offset')
        else next.set('offset', String(nextOffset))
        return next
      },
      { replace: true },
    )

  return (
    <div className="lib">
      <PeriodNav
        period={period}
        offset={offset}
        label={summary ? rangeLabel(summary.period, summary.start, summary.end) : null}
        onPeriod={(p) => navigate(p, 0)}
        onOffset={(o) => navigate(period, o)}
      />
      {query.isError && !summary ? (
        <div className="panel">
          <ErrorNote message={t('stats.error')} onRetry={() => query.refetch()} />
        </div>
      ) : !summary ? (
        <StatsSkeleton />
      ) : (
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
          <StatsContent summary={summary} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('stats.timezone', { tz: summary.timezone })} ·{' '}
            <Link to="/settings" className="underline underline-offset-2">
              {t('stats.timezone.edit')}
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
