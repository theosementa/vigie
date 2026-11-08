import { createContext, useContext } from 'react'
import type { Item } from '@/lib/api'

export interface ItemDialogsApi {
  /** Open the share dialog for an item. */
  share: (item: Item) => void
  /** Open the rename dialog for an item. */
  rename: (item: Item) => void
}

export const ItemDialogsContext = createContext<ItemDialogsApi | null>(null)

export function useItemDialogs(): ItemDialogsApi {
  const ctx = useContext(ItemDialogsContext)
  if (!ctx) throw new Error('useItemDialogs must be used inside <ItemDialogsProvider>')
  return ctx
}
