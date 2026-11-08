import { useEffect, useState } from 'react'

/** Matches the `leave` animation in motion.css (240 ms) plus a margin. */
const LEAVE_MS = 280
/** More removals than this at once means a new list (filter, search), not a row leaving. */
const MAX_LEAVING = 2

interface Gone<T> {
  item: T
  index: number
}

export interface Row<T> {
  item: T
  leaving: boolean
  /** Came back on its own (an Undo, a new item): open its place instead of popping in. */
  arrived: boolean
}

/**
 * Keeps rows that were just removed from `items` in the output for the length of their exit
 * animation, so the list can collapse them instead of dropping them. Only a pure removal of
 * one or two rows counts: anything else (new filter, new page, reorder) is a plain swap.
 */
export function useLeaving<T extends { id: string }>(items: T[]): Row<T>[] {
  const [state, setState] = useState<{ prev: T[]; gone: Gone<T>[]; arrived: ReadonlySet<string> }>({
    prev: items,
    gone: [],
    arrived: new Set(),
  })

  if (state.prev !== items) {
    const ids = new Set(items.map((i) => i.id))
    const prevIds = new Set(state.prev.map((i) => i.id))
    const removed = state.prev.flatMap((item, index) => (ids.has(item.id) ? [] : [{ item, index }]))
    const onlyRemovals = items.every((i) => prevIds.has(i.id))
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const animate = onlyRemovals && !reduced && removed.length > 0 && removed.length <= MAX_LEAVING
    const still = state.gone.filter((g) => !ids.has(g.item.id))
    // Same rule for additions; a row keeps the flag while mounted so its class never changes.
    const added = items.filter((i) => !prevIds.has(i.id))
    const arrive =
      state.prev.length > 0 && !reduced && added.length > 0 && added.length <= MAX_LEAVING && removed.length === 0
    const arrived = new Set([...state.arrived].filter((id) => ids.has(id)))
    if (arrive) added.forEach((i) => arrived.add(i.id))
    setState({ prev: items, gone: animate ? [...still, ...removed] : still, arrived })
  }

  useEffect(() => {
    if (state.gone.length === 0) return
    const timer = setTimeout(() => setState((s) => ({ ...s, gone: [] })), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [state.gone])

  const rows: Row<T>[] = items.map((item) => ({ item, leaving: false, arrived: state.arrived.has(item.id) }))
  for (const g of [...state.gone].sort((a, b) => a.index - b.index)) {
    rows.splice(Math.min(g.index, rows.length), 0, { item: g.item, leaving: true, arrived: false })
  }
  return rows
}
