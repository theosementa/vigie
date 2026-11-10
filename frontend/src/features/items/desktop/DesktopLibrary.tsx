import { useDesktopLayout } from '@/lib/mobileLayout'
import { ViewChips } from '@/features/views/ViewChips'
import { LibraryChips } from '../LibraryChips'
import { LibraryContent } from '../LibraryContent'
import { KpiStrip } from '../KpiStrip'
import { useTags } from '../queries'
import type { Library } from '../useLibrary'

export function DesktopLibrary({ lib }: { lib: Library }) {
  const { data: tags = [] } = useTags()
  const { filters, update, sharedOnly } = lib
  const [layout] = useDesktopLayout()
  return (
    <div className="lib">
      {!sharedOnly && <ViewChips />}
      <div className="lib-bar">
        <LibraryChips filters={filters} tags={tags} onChange={update} withCount={!sharedOnly} />
      </div>
      {!sharedOnly && <KpiStrip />}
      <LibraryContent lib={lib} variant={layout === 'list' ? 'rows' : 'cards'} />
    </div>
  )
}
