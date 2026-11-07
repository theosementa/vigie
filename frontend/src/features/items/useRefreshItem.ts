import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { useRefreshItem } from './queries'

/**
 * "Réessayer" / "Actualiser": relaunch the metadata fetch and say honestly what happened.
 * The server answers `refreshed: false` when the page still does not answer.
 */
export function useRefreshWithToast() {
  const t = useT()
  const refresh = useRefreshItem()
  return {
    pending: refresh.isPending,
    refresh: (id: string) =>
      refresh.mutate(id, {
        onSuccess: (res) =>
          res.refreshed ? toast.success(t('item.refresh.done')) : toast.error(t('item.refresh.failed')),
      }),
  }
}
