import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setPending } from '@/features/items/pendingDeletes'
import { deferDelete } from '@/features/items/undoDelete'
import { api, type SavedView } from '@/lib/api'
import { ellipsize } from '@/lib/format'
import { t } from '@/lib/i18n'
import { MAX_NAME } from './query'
import { viewsKey } from './queries'

async function commit(qc: QueryClient, id: string) {
  try {
    // keepalive lets the request outlive a closing page
    await api.views.remove(id, { keepalive: true })
  } catch {
    toast.error(t('view.delete_failed'))
  }
  await qc.invalidateQueries({ queryKey: viewsKey }) // the list is fresh before the view stops being hidden
  setPending(id, null)
}

/** Delete without confirmation: the view leaves at once and a toast offers Undo (as for items). */
export function useDeleteView() {
  const qc = useQueryClient()
  return useCallback(
    (view: SavedView) => {
      // `false`: not part of the pile, so only the views list hides it
      setPending(view.id, false)
      deferDelete(
        view.id,
        t('view.deleted', { name: ellipsize(view.name, MAX_NAME) }),
        () => void commit(qc, view.id),
        () => setPending(view.id, null),
      )
    },
    [qc],
  )
}
