import type { Item } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { ItemCard } from './ItemCard'
import { useItemDialogs } from './itemDialogsContext'
import { useSetItemStatus } from './queries'
import { SwipeableRow } from './SwipeableRow'

function SwipeableCard({
  item,
  selected,
  onOpen,
}: {
  item: Item
  selected: boolean
  onOpen: (item: Item) => void
}) {
  const setStatus = useSetItemStatus()
  const dialogs = useItemDialogs()
  const queue = useQueueToggle(item)
  const seen = item.status === 'seen'
  return (
    <SwipeableRow
      right={{
        label: seen ? 'À voir' : 'Vu',
        icon: seen ? <Icon name="restart" /> : <Icon name="check-circle" />,
        className: 'bg-accent text-on-accent',
        onTrigger: () => setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' }),
        // Swipe further to add / remove the video from the watch queue.
        extended: queue.available
          ? {
              label: queue.queued ? 'Retirer de la file' : 'File d’attente',
              icon: queue.queued ? <Icon name="list-minus-minimalistic" /> : <Icon name="list-plus-minimalistic" />,
              className: 'bg-text text-bg',
              onTrigger: queue.toggle,
            }
          : undefined,
      }}
      left={{
        label: 'Supprimer',
        icon: <Icon name="trash-bin-minimalistic" />,
        className: 'bg-over text-bg',
        onTrigger: () => dialogs.confirmDelete(item),
      }}
    >
      <ItemCard item={item} selected={selected} onOpen={onOpen} />
    </SwipeableRow>
  )
}

export function ItemGrid({
  items,
  selectedId,
  onOpen,
  className,
  swipeable,
}: {
  items: Item[]
  selectedId?: string | null
  onOpen: (item: Item) => void
  className?: string
  /** Mobile: swipe right = Vu/À voir, swipe left = delete. */
  swipeable?: boolean
}) {
  return (
    <ul className={cn('grid gap-4', className)}>
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          {swipeable ? (
            <SwipeableCard item={item} selected={item.id === selectedId} onOpen={onOpen} />
          ) : (
            <ItemCard item={item} selected={item.id === selectedId} onOpen={onOpen} />
          )}
        </li>
      ))}
    </ul>
  )
}
