import type { StatsSummary } from '@/lib/api'
import { fullName } from '@/lib/format'
import { formatCount, plural } from './format'
import { EmptyNote, StatsCard } from './StatsCard'

export function SharesCard({ shares }: { shares: StatsSummary['shares'] }) {
  return (
    <StatsCard title="Partages" className="md:col-span-2 xl:col-span-1">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Envoyés</dt>
          <dd className="text-3xl font-bold tabular-nums">{formatCount(shares.sent)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reçus</dt>
          <dd className="text-3xl font-bold tabular-nums">{formatCount(shares.received)}</dd>
        </div>
      </dl>
      {shares.by_user.length === 0 ? (
        <EmptyNote>Personne ne vous a partagé de contenu sur la période.</EmptyNote>
      ) : (
        <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          {shares.by_user.map((u) => (
            <li key={u.user_id}>
              <span className="font-semibold tabular-nums">{formatCount(u.count)}</span>{' '}
              {plural(u.count, 'article partagé', 'articles partagés')} par{' '}
              <span className="font-medium">{fullName(u)}</span>
            </li>
          ))}
        </ul>
      )}
    </StatsCard>
  )
}
