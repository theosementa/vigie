import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { useAddToQueue, useRemoveFromQueue } from './queries'

/** Queue state + toggle for one item. `available` is false for articles and seen videos that are not queued. */
export function useQueueToggle(item: Item) {
  const add = useAddToQueue()
  const remove = useRemoveFromQueue()
  const queued = item.queue_position !== null
  const available = item.resource.type === 'video' && (queued || item.status !== 'seen')

  const toggle = () => {
    if (queued) {
      remove.mutate(item.id, { onSuccess: () => toast('Retiré de la file d’attente') })
    } else {
      add.mutate({ item }, { onSuccess: () => toast.success('Ajouté à la file d’attente') })
    }
  }

  return { queued, available, toggle, pending: add.isPending || remove.isPending }
}
