import { memo } from 'react'
import type { Item } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ItemMeta } from './ItemMeta'
import { ItemThumb } from './ItemThumb'
import { isMetadataUnavailable, siteOf } from './metadata'

/** Phone list row: 64×48 thumbnail, 2-line title, meta. The title button stretches over the row. */
function ItemRowBase({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  const { resource } = item
  return (
    <div
      className={cn(
        'it',
        item.status === 'seen' && 'is-seen',
        isMetadataUnavailable(resource) && 'is-unknown',
      )}
    >
      <ItemThumb resource={resource} />
      <div>
        <button type="button" className="open tt" onClick={() => onOpen(item)}>
          <span>{resource.title || siteOf(resource)}</span>
        </button>
        <ItemMeta item={item} />
      </div>
    </div>
  )
}

export const ItemRow = memo(ItemRowBase)
