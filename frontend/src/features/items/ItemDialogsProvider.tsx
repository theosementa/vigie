import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useT } from '@/lib/i18n'
import { ItemDialogsContext, type ItemDialogsApi } from './itemDialogsContext'
import { ShareDialog } from './ShareDialog'
import { useDeleteItem } from './queries'
import { useLibraryFilters } from './useLibraryFilters'

/** Hosts the share dialog and the delete confirmation so cards, swipes and the detail can trigger them. */
export function ItemDialogsProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [shareTarget, setShareTarget] = useState<Item | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ item: Item; onDeleted?: () => void } | null>(
    null,
  )
  const del = useDeleteItem()
  const { itemId, update } = useLibraryFilters()

  const api: ItemDialogsApi = useMemo(
    () => ({
      share: setShareTarget,
      confirmDelete: (item, onDeleted) => setDeleteTarget({ item, onDeleted }),
    }),
    [],
  )

  const confirm = () => {
    if (!deleteTarget) return
    const { item, onDeleted } = deleteTarget
    setDeleteTarget(null)
    del.mutate(item.id, {
      onSuccess: () => {
        toast(t('item.deleted'))
        if (itemId === item.id) update({ item: null })
        onDeleted?.()
      },
      onError: () => toast.error(t('item.delete_failed')),
    })
  }

  return (
    <ItemDialogsContext.Provider value={api}>
      {children}
      <ShareDialog item={shareTarget} onClose={() => setShareTarget(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('item.delete.title')}
        description={t('item.delete.body', { title: deleteTarget?.item.resource.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={confirm}
      />
    </ItemDialogsContext.Provider>
  )
}
