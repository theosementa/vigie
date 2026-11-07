import { Link } from 'react-router-dom'
import type { StatsSummary } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { formatCount } from './format'
import { EmptyNote, StatsCard } from './StatsCard'

interface Row {
  key: string
  label: string
  count: number
  to: string
}

function RankedList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  const t = useT()
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <StatsCard title={title}>
      {rows.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <ol className="-mx-1 space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                to={r.to}
                className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-lg bg-chart-1/15"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
                <span className="relative min-w-0 truncate font-medium">{r.label}</span>
                <span className="relative shrink-0 text-muted-foreground tabular-nums">
                  {formatCount(r.count)}
                  <span className="sr-only"> {t('stats.items_seen', { count: r.count })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </StatsCard>
  )
}

/** Clicking a row opens the library (seen items) filtered on it. */
export function TopTagsCard({ tags }: { tags: StatsSummary['top_tags'] }) {
  const t = useT()
  return (
    <RankedList
      title={t('stats.top_tags')}
      empty={t('stats.top_tags.empty')}
      rows={tags.map((tag) => ({
        key: tag.name,
        label: `#${tag.name}`,
        count: tag.count,
        to: `/?status=seen&tag=${encodeURIComponent(tag.name)}`,
      }))}
    />
  )
}

// The library has no source filter: the search box matches the site name.
export function TopSourcesCard({ sources }: { sources: StatsSummary['top_sources'] }) {
  const t = useT()
  return (
    <RankedList
      title={t('stats.top_sources')}
      empty={t('stats.top_sources.empty')}
      rows={sources.map((s) => ({
        key: s.site_name,
        label: s.site_name,
        count: s.count,
        to: `/?status=seen&q=${encodeURIComponent(s.site_name)}`,
      }))}
    />
  )
}
