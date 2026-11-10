import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { useAddItem } from './addItemContext'
import { SearchField } from './SearchField'
import { useLibraryFilters } from './useLibraryFilters'

/** Desktop library header: the search (drives `?q=`) and « Ajouter », which opens the capture (also on N). */
export function CaptureBar() {
  const t = useT()
  const { open } = useAddItem()
  const { filters, update } = useLibraryFilters()
  return (
    <div className="capture">
      <SearchField value={filters.q} onChange={(q) => update({ q })} />
      <button type="button" className="btn btn-accent" onClick={() => open()}>
        <Icon name="add" />
        {t('nav.add')}
      </button>
    </div>
  )
}
