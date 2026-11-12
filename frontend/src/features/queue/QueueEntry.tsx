import { memo, type CSSProperties } from 'react'
import { Icon } from '@/components/Icon'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionsContextContent, ActionsDropdownContent } from '@/features/items/itemActions'
import type { Action } from '@/features/items/useItemActions'
import { ItemMeta } from '@/features/items/ItemMeta'
import { ItemThumb } from '@/features/items/ItemThumb'
import { isMetadataUnavailable, siteOf } from '@/features/items/metadata'
import { useT } from '@/lib/i18n'

export interface QueueEntryHandlers {
  onMove: (item: Item, position: number) => void
  onSeen: (item: Item) => void
  onRemove: (item: Item) => void
  onOpenDetail: (item: Item) => void
}

interface QueueEntryProps extends QueueEntryHandlers {
  item: Item
  index: number
  count: number
}

function QueueEntryBase({ item, index, count, onMove, onSeen, onRemove, onOpenDetail }: QueueEntryProps) {
  const t = useT()
  const { resource } = item
  const title = resource.title ?? resource.url
  const first = index === 0
  const last = index === count - 1

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--i': index % 8,
  } as CSSProperties

  const actions: Action[] = [
    {
      key: 'open',
      label: t('queue.open'),
      icon: <Icon name="arrow-right-up" />,
      run: () => window.open(resource.url, '_blank', 'noopener,noreferrer'),
    },
    { key: 'details', label: t('item.details'), icon: <Icon name="info-circle" />, run: () => onOpenDetail(item) },
    { key: 'seen', label: t('item.mark_seen'), icon: <Icon name="check-circle" />, run: () => onSeen(item) },
    {
      key: 'first',
      label: t('queue.move_first'),
      icon: <Icon name="arrow-up-to-line" />,
      separatorBefore: true,
      disabled: first,
      run: () => onMove(item, 0),
    },
    { key: 'up', label: t('queue.move_up'), icon: <Icon name="arrow-up" />, disabled: first, run: () => onMove(item, index - 1) },
    { key: 'down', label: t('queue.move_down'), icon: <Icon name="arrow-down" />, disabled: last, run: () => onMove(item, index + 1) },
    {
      key: 'remove',
      label: t('queue.remove'),
      icon: <Icon name="list-minus-minimalistic" />,
      destructive: true,
      run: () => onRemove(item),
    },
  ]

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('enter relative min-w-0', isDragging && 'z-10')}
      aria-label={t('queue.entry.label', { position: index + 1, count, title })}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              data-selected={isDragging || undefined}
              className={cn('it q-row', isMetadataUnavailable(resource) && 'is-unknown', isDragging && 'shadow-xl')}
            />
          }
        >
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t('queue.entry.drag', { title, position: index + 1, count })}
            className="above q-grip"
          >
            <Icon name="reorder" small aria-hidden />
          </button>
          <ItemThumb resource={resource} />
          <div>
            <button type="button" className="open tt" onClick={() => onOpenDetail(item)}>
              <span>{resource.title || siteOf(resource)}</span>
            </button>
            <ItemMeta item={item} />
          </div>
          <div className="flex items-center gap-2">
            {first && <span className="above q-next">{t('queue.next')}</span>}
            <div className="row-actions above">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t('queue.entry.actions', { title })}
                      title={t('item.actions')}
                    />
                  }
                >
                  <Icon name="menu-dots" small />
                </DropdownMenuTrigger>
                <ActionsDropdownContent actions={actions} />
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>
        <ActionsContextContent actions={actions} />
      </ContextMenu>
    </li>
  )
}

export const QueueEntry = memo(QueueEntryBase)
