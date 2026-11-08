import { createContext, useContext } from 'react'
import type { SavedView } from '@/lib/api'

export interface ViewDialogsApi {
  /** Ask a name for a new view holding this library query. */
  save: (query: string) => void
  /** Rename a view. */
  rename: (view: SavedView) => void
}

export const ViewDialogsContext = createContext<ViewDialogsApi | null>(null)

export function useViewDialogs(): ViewDialogsApi {
  const ctx = useContext(ViewDialogsContext)
  if (!ctx) throw new Error('useViewDialogs must be used inside <ViewDialogsProvider>')
  return ctx
}
