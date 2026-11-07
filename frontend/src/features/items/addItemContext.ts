import { createContext, useContext } from 'react'

export interface AddItemApi {
  /** Open the capture (full-screen sheet on a phone, modal from 768 px), optionally with a link already filled in. */
  open: (url?: string) => void
}

export const AddItemContext = createContext<AddItemApi | null>(null)

export function useAddItem(): AddItemApi {
  const ctx = useContext(AddItemContext)
  if (!ctx) throw new Error('useAddItem must be used inside <AddItemProvider>')
  return ctx
}
