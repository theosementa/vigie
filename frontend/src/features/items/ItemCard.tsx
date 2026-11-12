import { memo } from 'react'
import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionsContextContent, ActionsDropdownContent } from './itemActions'
import { ItemMeta } from './ItemMeta'
import { ItemThumb } from './ItemThumb'
import { isMetadataUnavailable, siteOf } from './metadata'
import { useItemActions } from './useItemActions'

/** Desktop grid card: 1.91:1 image, 2-line title, meta; menu button appears on hover. */
function ItemCardBase({
  item,
  selected,
  onOpen,
}: {
  item: Item
  selected?: boolean
  onOpen: (item: Item) => void
}) {
  const t = useT()
  const { resource } = item
  const actions = useItemActions(item, () => onOpen(item))
  const seen = item.status === 'seen'

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <article
            data-selected={selected}
            className={cn('card', seen && 'is-seen', isMetadataUnavailable(resource) && 'is-unknown')}
          />
        }
      >
        <ItemThumb resource={resource} />
        <div className="card-actions above">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className="icon-btn" aria-label={t('item.actions')} title={t('item.actions')} />}
            >
              <Icon name="menu-dots" small />
            </DropdownMenuTrigger>
            <ActionsDropdownContent actions={actions} />
          </DropdownMenu>
        </div>
        <div className="cb">
          <button type="button" className="open tt" onClick={() => onOpen(item)}>
            <span>{resource.title || siteOf(resource)}</span>
          </button>
          <ItemMeta item={item} />
        </div>
      </ContextMenuTrigger>
      <ActionsContextContent actions={actions} />
    </ContextMenu>
  )
}

export const ItemCard = memo(ItemCardBase)
