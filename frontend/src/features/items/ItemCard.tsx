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
import { useSetItemStatus } from './queries'
import { useItemActions } from './useItemActions'

/** Desktop grid card: 1.91:1 image, 2-line title, meta; status toggle and menu appear on hover. */
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
  const setStatus = useSetItemStatus()
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
          <button
            type="button"
            className="icon-btn"
            aria-pressed={seen}
            aria-label={t(seen ? 'item.mark_unseen' : 'item.mark_seen')}
            title={t(seen ? 'item.mark_unseen' : 'item.mark_seen')}
            onClick={() => setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' })}
          >
            <Icon name="check-circle" small bold={seen} />
          </button>
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
            {resource.title || siteOf(resource)}
          </button>
          <ItemMeta item={item} />
        </div>
      </ContextMenuTrigger>
      <ActionsContextContent actions={actions} />
    </ContextMenu>
  )
}

export const ItemCard = memo(ItemCardBase)
