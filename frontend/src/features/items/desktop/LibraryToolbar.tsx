import { AddItem } from '../AddItem'
import { SearchField } from '../SearchField'
import { StatusSegmented } from '../StatusSegmented'
import { TypeFilter } from '../TypeFilter'
import { useLibraryFilters } from '../useLibraryFilters'

/** Desktop top toolbar contents: search, À voir/Vu, type filter, add. State lives in the URL. */
export function LibraryToolbar() {
  const { filters, update } = useLibraryFilters()
  return (
    <>
      <SearchField value={filters.q} onChange={(q) => update({ q })} className="w-full max-w-xs" />
      <StatusSegmented value={filters.status} onChange={(status) => update({ status })} />
      <TypeFilter value={filters.type} onChange={(type) => update({ type })} />
      <div className="ml-auto">
        <AddItem />
      </div>
    </>
  )
}
