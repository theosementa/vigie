import type { CSSProperties } from 'react'
import type { Item } from '@/lib/api'
import { useLeaving } from '@/hooks/useLeaving'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { ItemCard } from './ItemCard'
import { ItemRow } from './ItemRow'
import { useSetItemStatus } from './queries'
import { SwipeableRow } from './SwipeableRow'
import { useDeleteItem } from './useDeleteItem'

function SwipeableItem({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  const t = useT()
  const setStatus = useSetItemStatus()
  const deleteItem = useDeleteItem()
  const queue = useQueueToggle(item)
  const seen = item.status === 'seen'
  return (
    <SwipeableRow
      right={{
        label: t(seen ? 'item.status.to_watch' : 'item.status.seen'),
        icon: <Icon name={seen ? 'restart' : 'check-circle'} />,
        className: 'bg-text text-bg',
        onTrigger: () => setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' }),
        // Swipe further to add / remove the video from the watch queue.
        extended: queue.available
          ? {
              label: t(queue.queued ? 'item.queue.remove_short' : 'item.queue.add_short'),
              icon: <Icon name={queue.queued ? 'list-minus-minimalistic' : 'list-plus-minimalistic'} />,
              className: 'bg-surface-2 text-text',
              onTrigger: queue.toggle,
            }
          : undefined,
      }}
      left={{
        label: t('common.delete'),
        icon: <Icon name="trash-bin-minimalistic" />,
        className: 'bg-over text-bg',
        onTrigger: () => deleteItem(item),
      }}
    >
      <ItemRow item={item} onOpen={onOpen} />
    </SwipeableRow>
  )
}

/** Phone: the DA list with swipe actions. Desktop: the card grid. */
export function ItemList({
  items,
  selectedId,
  onOpen,
  variant,
}: {
  items: Item[]
  selectedId?: string | null
  onOpen: (item: Item) => void
  variant: 'list' | 'cards'
}) {
  const rows = useLeaving(items)
  return (
    <ul className={variant === 'list' ? 'list' : 'cards'}>
      {rows.map(({ item, leaving, arrived }, index) => (
        <li
          key={item.id}
          // A row coming back (Undo) opens its height so the rows below slide down instead of jumping.
          className={cn('min-w-0', leaving ? 'leaving' : arrived && variant === 'list' ? 'expand' : 'enter')}
          style={leaving ? undefined : ({ '--i': index % 8 } as CSSProperties)}
          inert={leaving}
        >
          {variant === 'list' ? (
            <SwipeableItem item={item} onOpen={onOpen} />
          ) : (
            <ItemCard item={item} selected={item.id === selectedId} onOpen={onOpen} />
          )}
        </li>
      ))}
    </ul>
  )
}
