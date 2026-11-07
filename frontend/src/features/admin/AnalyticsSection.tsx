import { useState } from 'react'
import type { AnalyticsDays } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { useT, type MessageKey } from '@/lib/i18n'
import { AreaChart } from '@/features/stats/AreaChart'
import { Skeleton } from '@/features/stats/StatsCard'
import { useAdminAnalytics } from './queries'

const WINDOWS: AnalyticsDays[] = [7, 30, 90]

type SeriesKey = 'active_accounts' | 'items_added' | 'items_seen' | 'new_accounts'
const SERIES: { key: SeriesKey; label: MessageKey }[] = [
  { key: 'active_accounts', label: 'admin.analytics.series.active' },
  { key: 'items_added', label: 'admin.analytics.series.added' },
  { key: 'items_seen', label: 'admin.analytics.series.seen' },
  { key: 'new_accounts', label: 'admin.analytics.series.accounts' },
]

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl leading-none font-medium tabular-nums">
        {value === undefined ? <Skeleton className="h-6 w-10" /> : formatNumber(value)}
      </dd>
    </div>
  )
}

export function AnalyticsSection() {
  const t = useT()
  const [days, setDays] = useState<AnalyticsDays>(30)
  const [series, setSeries] = useState<SeriesKey>('active_accounts')
  const { data, error } = useAdminAnalytics(days)

  const points = (data?.series ?? []).map((p) => ({ bucket: p.day, value: p[series] }))
  const seriesLabel = t(SERIES.find((s) => s.key === series)!.label)

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h-label">{t('admin.analytics')}</h2>
        <div role="group" aria-label={t('admin.analytics.window')} className="seg">
          {WINDOWS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {t('admin.analytics.days', { days: d })}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t('admin.analytics.note')}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Tile label={t('admin.analytics.active_day')} value={data?.active.day} />
        <Tile label={t('admin.analytics.active_week')} value={data?.active.week} />
        <Tile label={t('admin.analytics.active_month')} value={data?.active.month} />
      </dl>

      <h3 className="mt-5 text-sm font-medium">{t('admin.analytics.window_title', { days })}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={t('admin.analytics.new_accounts')} value={data?.window.new_accounts} />
        <Tile label={t('admin.analytics.added')} value={data?.window.items_added} />
        <Tile label={t('admin.analytics.seen')} value={data?.window.items_seen} />
        <Tile label={t('admin.analytics.shares')} value={data?.window.shares} />
      </dl>

      <div role="group" aria-label={t('admin.analytics.series')} className="seg full mt-4">
        {SERIES.map((s) => (
          <button key={s.key} type="button" aria-pressed={series === s.key} onClick={() => setSeries(s.key)}>
            {t(s.label)}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {data ? (
          <AreaChart
            points={points}
            granularity="day"
            period={days === 7 ? 'week' : 'month'}
            label={`${t('admin.analytics.series')} · ${seriesLabel}`}
            valueLabel={seriesLabel}
          />
        ) : (
          <Skeleton className="h-[180px] w-full" />
        )}
      </div>

      <h3 className="mt-5 text-sm font-medium">{t('admin.analytics.now')}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label={t('admin.analytics.accounts')} value={data?.totals.accounts} />
        <Tile label={t('admin.analytics.items')} value={data?.totals.items} />
        <Tile label={t('admin.analytics.unseen')} value={data?.totals.unseen_items} />
        <Tile label={t('admin.analytics.queued')} value={data?.totals.queued_items} />
        <Tile label={t('admin.analytics.shared')} value={data?.totals.shared_items} />
        <Tile label={t('admin.analytics.invitations')} value={data?.totals.pending_invitations} />
      </dl>
    </section>
  )
}
