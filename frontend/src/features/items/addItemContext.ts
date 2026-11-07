import { createContext, useContext } from 'react'

export interface AddItemApi {
  /** Open the add-a-link flow (sheet on mobile, dialog on desktop). */
  open: () => void
}

export const AddItemContext = createContext<AddItemApi | null>(null)

export function useAddItem(): AddItemApi {
  const ctx = useContext(AddItemContext)
  if (!ctx) throw new Error('useAddItem must be used inside <AddItemProvider>')
  return ctx
}
