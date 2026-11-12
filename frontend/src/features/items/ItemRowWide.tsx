import { memo } from 'react'
import { Icon } from '@/components/Icon'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Item } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ActionsContextContent, ActionsDropdownContent } from './itemActions'
import { ItemMeta } from './ItemMeta'
import { ItemThumb } from './ItemThumb'
import { isMetadataUnavailable, siteOf } from './metadata'
import { useItemActions } from './useItemActions'

/**
 * Desktop and tablet list row: 96×54 thumbnail, one-line title, meta, and the menu button at the right edge. The height is set by the thumbnail, so it never changes when the page resizes.
 */
function ItemRowWideBase({
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
          <div
            data-selected={selected}
            className={cn('it', seen && 'is-seen', isMetadataUnavailable(resource) && 'is-unknown')}
          />
        }
      >
        <ItemThumb resource={resource} />
        <div>
          <button type="button" className="open tt" onClick={() => onOpen(item)}>
            <span>{resource.title || siteOf(resource)}</span>
          </button>
          <ItemMeta item={item} />
        </div>
        <div className="row-actions above">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className="icon-btn" aria-label={t('item.actions')} title={t('item.actions')} />}
            >
              <Icon name="menu-dots" small />
            </DropdownMenuTrigger>
            <ActionsDropdownContent actions={actions} />
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ActionsContextContent actions={actions} />
    </ContextMenu>
  )
}

export const ItemRowWide = memo(ItemRowWideBase)
