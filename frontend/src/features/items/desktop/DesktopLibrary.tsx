import { ViewChips } from '@/features/views/ViewChips'
import { LibraryChips } from '../LibraryChips'
import { LibraryContent } from '../LibraryContent'
import { KpiStrip } from '../KpiStrip'
import { useTags } from '../queries'
import { SearchField } from '../SearchField'
import type { Library } from '../useLibrary'

export function DesktopLibrary({ lib }: { lib: Library }) {
  const { data: tags = [] } = useTags()
  const { filters, update, sharedOnly } = lib
  return (
    <div className="lib">
      {!sharedOnly && <ViewChips />}
      <div className="lib-bar">
        <LibraryChips filters={filters} tags={tags} onChange={update} withCount={!sharedOnly} />
        <SearchField value={filters.q} onChange={(q) => update({ q })} className="w-52 flex-none" />
      </div>
      {!sharedOnly && <KpiStrip />}
      <LibraryContent lib={lib} variant="cards" />
    </div>
  )
}
