import type { ReactNode } from 'react'
import { ExternalLink, ListEnd, ListMinus, Pencil, Share2, Trash2 } from 'lucide-react'
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
      icon: <ExternalLink />,
      run: () => window.open(item.resource.url, '_blank', 'noopener,noreferrer'),
    },
    ...(queue.available
      ? [
          {
            key: 'queue',
            label: queue.queued ? 'Retirer de la file' : 'Ajouter à la file d’attente',
            icon: queue.queued ? <ListMinus /> : <ListEnd />,
            run: queue.toggle,
          },
        ]
      : []),
    { key: 'share', label: 'Partager', icon: <Share2 />, run: () => dialogs.share(item) },
    { key: 'edit', label: 'Modifier', icon: <Pencil />, run: onOpenDetail },
    {
      key: 'delete',
      label: 'Supprimer',
      icon: <Trash2 />,
      destructive: true,
      run: () => dialogs.confirmDelete(item),
    },
  ]
}
