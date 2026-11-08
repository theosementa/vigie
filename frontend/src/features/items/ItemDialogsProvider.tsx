import { useMemo, useState, type ReactNode } from 'react'
import type { Item } from '@/lib/api'
import { ItemDialogsContext, type ItemDialogsApi } from './itemDialogsContext'
import { RenameDialog } from './RenameDialog'
import { ShareDialog } from './ShareDialog'

/** Hosts the share and rename dialogs so cards, swipes and the detail can trigger them. */
export function ItemDialogsProvider({ children }: { children: ReactNode }) {
  const [shareTarget, setShareTarget] = useState<Item | null>(null)
  const [renameTarget, setRenameTarget] = useState<Item | null>(null)

  const api: ItemDialogsApi = useMemo(
    () => ({ share: setShareTarget, rename: setRenameTarget }),
    [],
  )

  return (
    <ItemDialogsContext.Provider value={api}>
      {children}
      <ShareDialog item={shareTarget} onClose={() => setShareTarget(null)} />
      <RenameDialog item={renameTarget} onClose={() => setRenameTarget(null)} />
    </ItemDialogsContext.Provider>
  )
}
