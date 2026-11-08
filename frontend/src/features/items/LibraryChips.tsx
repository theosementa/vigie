import { usePile } from '@/features/stats/queries'
import type { ItemStatus, ResourceType, TagWithCount } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useResourceTypes } from './useResourceTypes'
import type { LibraryFilters } from './useLibraryFilters'

type Patch = { status?: ItemStatus; type?: ResourceType | 'all'; tag?: string | null }

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

/** Filter chips of the DA: À voir (with the exact count), Vu, type, tags. They drive the URL filters. */
export function LibraryChips({
  filters,
  tags,
  onChange,
  withCount,
}: {
  filters: LibraryFilters
  tags: TagWithCount[]
  onChange: (patch: Patch) => void
  /** The count is the whole pile, so only the library (not "shared with me") shows it. */
  withCount: boolean
}) {
  const t = useT()
  const { pile } = usePile()
  const types = useResourceTypes(filters.type === 'all' ? undefined : filters.type)
  return (
    <div className="chips" role="group" aria-label={t('filters.label')}>
      <Chip active={filters.status === 'to_watch'} onClick={() => onChange({ status: 'to_watch' })}>
        {t('filters.to_watch')}
        {withCount && pile && <b>{formatNumber(pile.count)}</b>}
      </Chip>
      <Chip active={filters.status === 'seen'} onClick={() => onChange({ status: 'seen' })}>
        {t('filters.seen')}
      </Chip>
      {types.map((type) => (
        <Chip key={type} active={filters.type === type} onClick={() => onChange({ type: filters.type === type ? 'all' : type })}>
          {t(`filters.${type}`)}
        </Chip>
      ))}
      {tags.map((tag) => (
        <Chip key={tag.id} active={filters.tag === tag.name} onClick={() => onChange({ tag: filters.tag === tag.name ? null : tag.name })}>
          #{tag.name}
        </Chip>
      ))}
    </div>
  )
}
