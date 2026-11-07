import { Link } from 'react-router-dom'
import { formatMinutes, formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useWeek } from './useWeek'

const RINGS = [
  { r: 54, opacity: 1 },
  { r: 40, opacity: 0.7 },
  { r: 26, opacity: 0.45 },
] as const

/** The scope of the DA: the weekly goals as three concentric radar rings. Links to the statistics. */
export function ScopePanel() {
  const t = useT()
  const { week, isError } = useWeek()
  if (isError && !week) return null
  if (!week) return <div className="panel scope" aria-busy="true" style={{ minHeight: 146 }} />

  const ratios = [
    week.seen / week.goalSeen,
    week.watchMinutes / week.goalMinutes,
    week.best > 0 ? week.streak / week.best : 0,
  ].map((v) => Math.min(Math.max(v, 0), 1))
  const watch = formatMinutes(week.watchMinutes)
  const goalWatch = formatMinutes(week.goalMinutes)

  return (
    <Link to="/stats" className="panel scope">
      <svg
        width="112"
        height="112"
        viewBox="0 0 120 120"
        role="img"
        aria-label={t('scope.aria', {
          seen: week.seen,
          goal: week.goalSeen,
          watch,
          goalWatch,
          streak: week.streak,
          best: week.best,
        })}
      >
        <g className="grid">
          {RINGS.map((ring) => (
            <circle key={ring.r} cx="60" cy="60" r={ring.r} />
          ))}
          <path d="M60 2v116M2 60h116" />
        </g>
        {RINGS.map((ring, i) => (
          <circle
            key={ring.r}
            className="ring"
            cx="60"
            cy="60"
            r={ring.r}
            strokeWidth="4"
            strokeDasharray={`${(ratios[i] * 2 * Math.PI * ring.r).toFixed(1)} 400`}
            style={{ opacity: ring.opacity }}
          />
        ))}
        <circle cx="60" cy="60" r="3.5" fill="var(--accent-ink)" />
      </svg>
      <ul>
        <li>
          {t('scope.seen')}
          <b>
            {formatNumber(week.seen)}
            <small>/ {formatNumber(week.goalSeen)}</small>
          </b>
        </li>
        <li>
          <span>
            {t('scope.watch')}{' '}
            <span className="conf">{t(week.videosWithoutDuration > 0 ? 'conf.partial' : 'conf.measured')}</span>
          </span>
          <b>
            {watch}
            <small>/ {goalWatch}</small>
          </b>
        </li>
        <li>
          {t('scope.streak')}
          <b>
            {t('scope.days', { count: week.streak })}
            <small>{t('scope.record', { best: week.best })}</small>
          </b>
        </li>
      </ul>
    </Link>
  )
}
