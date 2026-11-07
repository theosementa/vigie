import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useAddToQueue, useRemoveFromQueue } from './queries'

/** Queue state + toggle for one item. `available` is false for articles and seen videos that are not queued. */
export function useQueueToggle(item: Item) {
  const add = useAddToQueue()
  const remove = useRemoveFromQueue()
  const queued = item.queue_position !== null
  const available = item.resource.type === 'video' && (queued || item.status !== 'seen')

  const toggle = () => {
    if (queued) {
      remove.mutate(item.id, { onSuccess: () => toast(t('queue.removed')) })
    } else {
      add.mutate({ item }, { onSuccess: () => toast.success(t('queue.added')) })
    }
  }

  return { queued, available, toggle, pending: add.isPending || remove.isPending }
}
