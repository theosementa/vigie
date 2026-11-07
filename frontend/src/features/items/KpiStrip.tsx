import { usePile } from '@/features/stats/queries'
import { formatMinutes, formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useWeek } from './useWeek'

const MINUS = '−'
const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `${MINUS}${formatNumber(-n)}` : '0')

/** Desktop KPI strip: seen this week, watch time, streak, 28-day pile. */
export function KpiStrip() {
  const t = useT()
  const { week, isError } = useWeek()
  const { pile } = usePile()
  if (isError && !week) return null
  if (!week)
    return (
      <div className="strip" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel" style={{ minHeight: 110 }} />
        ))}
      </div>
    )

  const diff = week.seen - week.prevSeen
  return (
    <div className="strip">
      <div className="panel">
        <h5>{t('kpi.seen')}</h5>
        <div className="kpi">
          {formatNumber(week.seen)}
          <small>/ {formatNumber(week.goalSeen)}</small>
        </div>
        <div className="sub">{t('kpi.vs_last_week', { diff: signed(diff) })}</div>
      </div>
      <div className="panel">
        <h5>
          {t('kpi.watch')}
          <span className="conf">{t(week.videosWithoutDuration > 0 ? 'conf.partial' : 'conf.measured')}</span>
        </h5>
        <div className="kpi">{formatMinutes(week.watchMinutes)}</div>
        <div className="sub">
          {week.videosWithoutDuration > 0
            ? t('kpi.videos_no_duration', { count: week.videosWithoutDuration })
            : t('kpi.videos_seen', { count: week.videosSeen })}
        </div>
      </div>
      <div className="panel">
        <h5>{t('kpi.streak')}</h5>
        <div className="kpi">
          {week.streak}
          <small>{t('kpi.days', { count: week.streak })}</small>
        </div>
        <div className="sub">{t('kpi.record', { best: week.best })}</div>
      </div>
      <div className="panel">
        <h5>{t('kpi.pile')}</h5>
        {pile ? (
          <>
            <div className="kpi">{pile.delta === 0 ? '0' : signed(pile.delta)}</div>
            <span className={`badge s-${pile.state}`}>{t(`pile.${pile.state}`)}</span>
          </>
        ) : (
          <div className="kpi">…</div>
        )}
      </div>
    </div>
  )
}
