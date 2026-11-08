import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, type Item } from '@/lib/api'
import { ellipsize } from '@/lib/format'
import { t } from '@/lib/i18n'
import { refreshAfterDelete, itemKey } from './queries'
import { setPending } from './pendingDeletes'
import { deferDelete } from './undoDelete'
import { useLibraryFilters } from './useLibraryFilters'

const TITLE_MAX = 40

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

      deferDelete(
        id,
        t('item.deleted', { title: ellipsize(item.resource.title, TITLE_MAX) }),
        () => void commit(qc, id),
        () => setPending(id, null),
      )
    },
    [qc, itemId, update],
  )
}
