import { Icon } from '@/components/Icon'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { ViewChips } from '@/features/views/ViewChips'
import { LibraryChips } from '../LibraryChips'
import { LibraryContent } from '../LibraryContent'
import { useTags } from '../queries'
import { ScopePanel } from '../ScopePanel'
import { SearchField } from '../SearchField'
import { useSearchOpen } from '../searchOpen'
import { useMobileLayout } from '@/lib/mobileLayout'
import type { Library } from '../useLibrary'

export function MobileLibrary({ lib }: { lib: Library }) {
  const { data: tags = [] } = useTags()
  const { filters, update, selected, refetch, sharedOnly } = lib
  const searchOpen = useSearchOpen()
  const [layout] = useMobileLayout()
  const { pull, refreshing } = usePullToRefresh(refetch, selected === null)
  return (
    <div className="lib">
      <div
        aria-hidden={pull === 0 && !refreshing}
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+2.75rem)] z-20 flex justify-center transition-opacity"
        style={{ opacity: pull > 8 || refreshing ? 1 : 0, transform: `translateY(${pull * 0.6}px)` }}
      >
        <span className="icon-btn" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <Icon
            name="loader"
            small
            className={refreshing ? 'animate-spin' : undefined}
            style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
          />
        </span>
      </div>
      {(searchOpen || filters.q !== '') && (
        <SearchField value={filters.q} onChange={(q) => update({ q })} autoFocus={searchOpen && filters.q === ''} />
      )}
      {!sharedOnly && <ViewChips />}
      <LibraryChips filters={filters} tags={tags} onChange={update} withCount={!sharedOnly} />
      {!sharedOnly && <ScopePanel />}
      <LibraryContent lib={lib} variant={layout === 'grid' ? 'cards' : 'list'} />
    </div>
  )
}
