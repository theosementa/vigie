import type { StatsSummary } from '@/lib/api'
import { fullName } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { formatCount } from './format'
import { EmptyNote, StatsCard } from './StatsCard'

export function SharesCard({ shares }: { shares: StatsSummary['shares'] }) {
  const t = useT()
  return (
    <StatsCard title={t('stats.shares')} className="md:col-span-2 xl:col-span-1">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.shares.sent')}</dt>
          <dd className="text-3xl font-medium tabular-nums">{formatCount(shares.sent)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.shares.received')}</dt>
          <dd className="text-3xl font-medium tabular-nums">{formatCount(shares.received)}</dd>
        </div>
      </dl>
      {shares.by_user.length === 0 ? (
        <EmptyNote>{t('stats.shares.empty')}</EmptyNote>
      ) : (
        <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          {shares.by_user.map((u) => (
            <li key={u.user_id}>
              <span className="font-medium tabular-nums">{formatCount(u.count)}</span>{' '}
              {t('stats.shares.by', { count: u.count, name: fullName(u) })}
            </li>
          ))}
        </ul>
      )}
    </StatsCard>
  )
}
