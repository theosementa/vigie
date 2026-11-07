import { Link } from 'react-router-dom'
import type { StatsSummary } from '@/lib/api'
import { formatCount, plural } from './format'
import { EmptyNote, StatsCard } from './StatsCard'

interface Row {
  key: string
  label: string
  count: number
  to: string
}

function RankedList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
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
                  <span className="sr-only"> {plural(r.count, 'élément vu', 'éléments vus')}</span>
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
  return (
    <RankedList
      title="Top tags"
      empty="Aucun tag sur les éléments vus de la période."
      rows={tags.map((t) => ({
        key: t.name,
        label: `#${t.name}`,
        count: t.count,
        to: `/?status=seen&tag=${encodeURIComponent(t.name)}`,
      }))}
    />
  )
}

// The library has no source filter: the search box matches the site name.
export function TopSourcesCard({ sources }: { sources: StatsSummary['top_sources'] }) {
  return (
    <RankedList
      title="Top sources"
      empty="Aucune source sur les éléments vus de la période."
      rows={sources.map((s) => ({
        key: s.site_name,
        label: s.site_name,
        count: s.count,
        to: `/?status=seen&q=${encodeURIComponent(s.site_name)}`,
      }))}
    />
  )
}
