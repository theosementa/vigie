import type { ItemStatus, ResourceType, TagWithCount } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LibraryFilters } from '../useLibraryFilters'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-border',
      )}
    >
      {children}
    </button>
  )
}

/** Horizontally scrolling filter chips (status, type, tags). */
export function FilterChips({
  filters,
  tags,
  onChange,
}: {
  filters: LibraryFilters
  tags: TagWithCount[]
  onChange: (patch: { status?: ItemStatus; type?: ResourceType | 'all'; tag?: string | null }) => void
}) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Chip active={filters.status === 'to_watch'} onClick={() => onChange({ status: 'to_watch' })}>
        À voir
      </Chip>
      <Chip active={filters.status === 'seen'} onClick={() => onChange({ status: 'seen' })}>
        Vu
      </Chip>
      <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />
      <Chip active={filters.type === 'video'} onClick={() => onChange({ type: filters.type === 'video' ? 'all' : 'video' })}>
        Vidéos
      </Chip>
      <Chip active={filters.type === 'article'} onClick={() => onChange({ type: filters.type === 'article' ? 'all' : 'article' })}>
        Articles
      </Chip>
      {tags.length > 0 && <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />}
      {tags.map((t) => (
        <Chip
          key={t.id}
          active={filters.tag === t.name}
          onClick={() => onChange({ tag: filters.tag === t.name ? null : t.name })}
        >
          #{t.name}
        </Chip>
      ))}
    </div>
  )
}
