import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { useItemDialogs } from './itemDialogsContext'

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
  return [
    {
      key: 'open',
      label: t('item.open_link'),
      icon: <Icon name="arrow-right-up" />,
      run: () => window.open(item.resource.url, '_blank', 'noopener,noreferrer'),
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
      run: () => dialogs.confirmDelete(item),
    },
  ]
}
