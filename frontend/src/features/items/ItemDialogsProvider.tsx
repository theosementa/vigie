import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ItemDialogsContext, type ItemDialogsApi } from './itemDialogsContext'
import { ShareDialog } from './ShareDialog'
import { useDeleteItem } from './queries'
import { useLibraryFilters } from './useLibraryFilters'

/** Hosts the share dialog and the delete confirmation so cards, swipes and the detail can trigger them. */
export function ItemDialogsProvider({ children }: { children: ReactNode }) {
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
        toast('Élément supprimé')
        if (itemId === item.id) update({ item: null })
        onDeleted?.()
      },
      onError: () => toast.error('Suppression impossible. Réessayez.'),
    })
  }

  return (
    <ItemDialogsContext.Provider value={api}>
      {children}
      <ShareDialog item={shareTarget} onClose={() => setShareTarget(null)} />
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cet élément ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.item.resource.title} » sera retiré de votre bibliothèque. Cette
              action est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirm}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ItemDialogsContext.Provider>
  )
}
