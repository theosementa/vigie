import { useSyncExternalStore } from 'react'

/**
 * Items whose deletion waits for the Undo toast to end (id -> was in the pile). Lists, the queue
 * and the pile count hide them meanwhile, so a refetch cannot bring a card back before the request.
 */
let pending: ReadonlyMap<string, boolean> = new Map()
const listeners = new Set<() => void>()

/** `inPile` hides the item; `null` shows it again. */
export function setPending(id: string, inPile: boolean | null) {
  const next = new Map(pending)
  if (inPile === null) next.delete(id)
  else next.set(id, inPile)
  pending = next
  listeners.forEach((l) => l())
}

export function usePendingDeletes(): ReadonlyMap<string, boolean> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}
