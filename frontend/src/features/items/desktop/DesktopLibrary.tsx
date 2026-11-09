import { ViewChips } from '@/features/views/ViewChips'
import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { useDesktopLayout } from '@/lib/mobileLayout'
import { LibraryChips } from '../LibraryChips'
import { LibraryContent } from '../LibraryContent'
import { KpiStrip } from '../KpiStrip'
import { useTags } from '../queries'
import { SearchField } from '../SearchField'
import type { Library } from '../useLibrary'

export function DesktopLibrary({ lib }: { lib: Library }) {
  const { data: tags = [] } = useTags()
  const { filters, update, sharedOnly } = lib
  const t = useT()
  const [layout, setLayout] = useDesktopLayout()
  return (
    <div className="lib">
      {!sharedOnly && <ViewChips />}
      <div className="lib-bar">
        <LibraryChips filters={filters} tags={tags} onChange={update} withCount={!sharedOnly} />
        <SearchField value={filters.q} onChange={(q) => update({ q })} className="w-52 flex-none" />
        <div role="group" aria-label={t('layout.desktop_label')} className="seg full flex-none">
          <button type="button" aria-pressed={layout === 'grid'} aria-label={t('layout.grid')} title={t('layout.grid')} onClick={() => setLayout('grid')}>
            <Icon name="widget-2" small />
          </button>
          <button type="button" aria-pressed={layout === 'list'} aria-label={t('layout.list')} title={t('layout.list')} onClick={() => setLayout('list')}>
            <Icon name="list" small />
          </button>
        </div>
      </div>
      {!sharedOnly && <KpiStrip />}
      <LibraryContent lib={lib} variant={layout === 'list' ? 'rows' : 'cards'} />
    </div>
  )
}
