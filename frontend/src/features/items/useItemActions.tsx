import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { useSetItemStatus } from './queries'
import { useItemDialogs } from './itemDialogsContext'
import { useDeleteItem } from './useDeleteItem'

export interface Action {
  key: string
  label: string
  icon: ReactNode
  destructive?: boolean
  run: () => void
}

export function useItemActions(item: Item, onOpenDetail: () => void): Action[] {
  const t = useT()
  const dialogs = useItemDialogs()
  const queue = useQueueToggle(item)
  const deleteItem = useDeleteItem()
  const setStatus = useSetItemStatus()
  const seen = item.status === 'seen'
  return [
    {
      key: 'open',
      label: t('item.open_link'),
      icon: <Icon name="arrow-right-up" />,
      run: () => window.open(item.resource.url, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'status',
      label: t(seen ? 'item.mark_unseen' : 'item.mark_seen'),
      icon: <Icon name={seen ? 'restart' : 'check-circle'} />,
      run: () => setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' }),
    },
    ...(queue.available
      ? [
          {
            key: 'queue',
            label: t(queue.queued ? 'item.queue.remove' : 'item.queue.add'),
            icon: <Icon name={queue.queued ? 'list-minus-minimalistic' : 'list-plus-minimalistic'} />,
            run: queue.toggle,
          },
        ]
      : []),
    { key: 'share', label: t('item.share'), icon: <Icon name="share" />, run: () => dialogs.share(item) },
    { key: 'rename', label: t('item.rename'), icon: <Icon name="pen" />, run: () => dialogs.rename(item) },
    { key: 'edit', label: t('item.details'), icon: <Icon name="info-circle" />, run: onOpenDetail },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: <Icon name="trash-bin-minimalistic" />,
      destructive: true,
      run: () => deleteItem(item),
    },
  ]
}
