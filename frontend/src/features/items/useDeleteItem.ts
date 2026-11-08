import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, type Item } from '@/lib/api'
import { ellipsize } from '@/lib/format'
import { t } from '@/lib/i18n'
import { refreshAfterDelete, itemKey } from './queries'
import { setPending } from './pendingDeletes'
import { useLibraryFilters } from './useLibraryFilters'

const UNDO_MS = 5000
const TITLE_MAX = 40

/** Deletions waiting for their toast to end, each with the function that sends it now. */
const waiting = new Map<string, (dismiss?: boolean) => void>()

/** The page is going away or hidden (timers stop in the background): send everything right now. */
function sendAll() {
  for (const send of [...waiting.values()]) send(true)
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendAll()
})
addEventListener('pagehide', sendAll)

async function commit(qc: QueryClient, id: string) {
  try {
    // keepalive lets the request outlive a closing page
    await api.items.remove(id, { keepalive: true })
  } catch {
    setPending(id, null)
    toast.error(t('item.delete_failed'))
    void refreshAfterDelete(qc)
    return
  }
  qc.removeQueries({ queryKey: itemKey(id) })
  await refreshAfterDelete(qc) // the lists are fresh before the card stops being hidden
  setPending(id, null)
}

/**
 * Delete without confirmation: the card leaves at once and a toast offers Undo. The request is
 * sent when the toast ends or is dismissed, so Undo never needs a server-side restore.
 */
export function useDeleteItem() {
  const qc = useQueryClient()
  const { itemId, update } = useLibraryFilters()
  return useCallback(
    (item: Item, onDeleted?: () => void) => {
      const id = item.id
      setPending(id, item.status === 'to_watch')
      if (itemId === id) update({ item: null })
      onDeleted?.()

      const send = (dismiss = false) => {
        if (!waiting.delete(id)) return
        if (dismiss) toast.dismiss(toastId)
        void commit(qc, id)
      }
      const toastId = toast(t('item.deleted', { title: ellipsize(item.resource.title, TITLE_MAX) }), {
        duration: UNDO_MS,
        onAutoClose: () => send(),
        onDismiss: () => send(),
        action: {
          label: t('common.undo'),
          onClick: () => {
            waiting.delete(id)
            setPending(id, null)
          },
        },
      })
      waiting.set(id, send)
    },
    [qc, itemId, update],
  )
}
