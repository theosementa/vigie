import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
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
  const dialogs = useItemDialogs()
  const queue = useQueueToggle(item)
  return [
    {
      key: 'open',
      label: 'Ouvrir le lien',
      icon: <Icon name="arrow-right-up" />,
      run: () => window.open(item.resource.url, '_blank', 'noopener,noreferrer'),
    },
    ...(queue.available
      ? [
          {
            key: 'queue',
            label: queue.queued ? 'Retirer de la file' : 'Ajouter à la file d’attente',
            icon: queue.queued ? <Icon name="list-minus-minimalistic" /> : <Icon name="list-plus-minimalistic" />,
            run: queue.toggle,
          },
        ]
      : []),
    { key: 'share', label: 'Partager', icon: <Icon name="share" />, run: () => dialogs.share(item) },
    { key: 'edit', label: 'Modifier', icon: <Icon name="pen" />, run: onOpenDetail },
    {
      key: 'delete',
      label: 'Supprimer',
      icon: <Icon name="trash-bin-minimalistic" />,
      destructive: true,
      run: () => dialogs.confirmDelete(item),
    },
  ]
}
