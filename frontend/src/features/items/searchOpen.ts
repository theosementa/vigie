import { useSyncExternalStore } from 'react'

/** Phone: whether the search field under the Library header is open (toggled by the header's search button). */
let open = false
const listeners = new Set<() => void>()

export function setSearchOpen(next: boolean) {
  if (next === open) return
  open = next
  listeners.forEach((l) => l())
}

export function useSearchOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => open,
    () => false,
  )
}
