import { useTags } from '../queries'
import { Icon } from '@/components/Icon'
import { LibraryContent } from '../LibraryContent'
import { SearchField } from '../SearchField'
import { FilterChips } from './FilterChips'
import { ItemDetailBottomSheet } from './ItemDetailBottomSheet'
import type { Library } from '../useLibrary'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

export function MobileLibrary({ lib }: { lib: Library }) {
  const { data: tags = [] } = useTags()
  const { filters, update, selected, close, refetch } = lib
  const { pull, refreshing } = usePullToRefresh(refetch, selected === null)
  return (
    <div className="space-y-3">
      <div
        aria-hidden={pull === 0 && !refreshing}
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+2.75rem)] z-20 flex justify-center transition-opacity"
        style={{ opacity: pull > 8 || refreshing ? 1 : 0, transform: `translateY(${pull * 0.6}px)` }}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-surface shadow ring-1 ring-line">
          <Icon name="loader"
            className={refreshing ? 'size-4 animate-spin' : 'size-4'}
            style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
          />
        </span>
      </div>
      <SearchField value={filters.q} onChange={(q) => update({ q })} />
      <FilterChips filters={filters} tags={tags} onChange={update} />
      <LibraryContent lib={lib} className="grid-cols-1 landscape:grid-cols-2" swipeable />
      <ItemDetailBottomSheet item={selected} onClose={close} />
    </div>
  )
}
