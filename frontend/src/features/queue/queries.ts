/** Data hooks for the watch queue, backed by the real API (src/lib/api.ts). */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, type Item, type QueueList } from '@/lib/api'
import {
  itemKey,
  itemsKey,
  itemsListKey,
  mapLists,
  putItem,
  queueKey,
  restore,
  snapshot,
} from '@/features/items/queries'

export { queueKey }

/** Ordered list of queued videos (no pagination). */
export function useQueue() {
  return useQuery({
    queryKey: queueKey,
    queryFn: () => api.queue.list(),
    staleTime: 30_000,
  })
}

/** Move `from` to `to` (clamped), returning a new array. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to))
  if (from < 0 || from >= list.length || from === target) return list
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

const renumber = (items: Item[]): Item[] => items.map((i, idx) => ({ ...i, queue_position: idx }))

/** Mirror queue positions onto every cached copy of the items (lists + detail). */
function syncPositions(qc: QueryClient, positions: Map<string, number | null>) {
  const patch = (i: Item): Item =>
    positions.has(i.id) ? { ...i, queue_position: positions.get(i.id)! } : i
  mapLists(qc, (items) => items.map(patch))
  for (const id of positions.keys()) qc.setQueryData<Item>(itemKey(id), (i) => (i ? patch(i) : i))
}

const mutationKey = ['queue', 'mutate'] as const

/** Refetch once the last in-flight queue mutation settles, so rapid reorders do not flicker. */
function settle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey }) > 1) return
  qc.invalidateQueries({ queryKey: queueKey })
  qc.invalidateQueries({ queryKey: itemsListKey })
}

export function useAddToQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey,
    meta: { errorMessage: 'Impossible d’ajouter à la file d’attente.' },
    mutationFn: ({ item, position }: { item: Item; position?: number | null }) =>
      api.queue.add(item.id, position),
    onMutate: async ({ item, position }) => {
      await qc.cancelQueries({ queryKey: queueKey })
      await qc.cancelQueries({ queryKey: itemsKey })
      const snap = snapshot(qc)
      const current = qc.getQueryData<QueueList>(queueKey)
      if (current && !current.items.some((i) => i.id === item.id)) {
        const at = position == null ? current.items.length : Math.max(0, position)
        const items = renumber([
          ...current.items.slice(0, at),
          item,
          ...current.items.slice(at),
        ])
        qc.setQueryData<QueueList>(queueKey, { items })
        syncPositions(qc, new Map(items.map((i) => [i.id, i.queue_position])))
      } else if (!current) {
        syncPositions(qc, new Map([[item.id, position ?? 0]]))
      }
      return { snap }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSuccess: (item) => putItem(qc, item),
    onSettled: () => settle(qc),
  })
}

export function useRemoveFromQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey,
    meta: { errorMessage: 'Impossible de retirer de la file d’attente.' },
    mutationFn: (id: string) => api.queue.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queueKey })
      await qc.cancelQueries({ queryKey: itemsKey })
      const snap = snapshot(qc)
      const positions = new Map<string, number | null>([[id, null]])
      const current = qc.getQueryData<QueueList>(queueKey)
      if (current) {
        const items = renumber(current.items.filter((i) => i.id !== id))
        items.forEach((i) => positions.set(i.id, i.queue_position))
        qc.setQueryData<QueueList>(queueKey, { items })
      }
      syncPositions(qc, positions)
      return { snap }
    },
    onError: (_e, _id, ctx) => restore(qc, ctx?.snap),
    onSettled: () => settle(qc),
  })
}

/** Move an entry to a 0-based position (clamped), optimistically. */
export function useMoveInQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey,
    meta: { errorMessage: 'Impossible de réorganiser la file d’attente.' },
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.queue.move(id, position),
    onMutate: async ({ id, position }) => {
      await qc.cancelQueries({ queryKey: queueKey })
      await qc.cancelQueries({ queryKey: itemsKey })
      const snap = snapshot(qc)
      const current = qc.getQueryData<QueueList>(queueKey)
      if (current) {
        const from = current.items.findIndex((i) => i.id === id)
        const items = renumber(reorder(current.items, from, position))
        qc.setQueryData<QueueList>(queueKey, { items })
        syncPositions(qc, new Map(items.map((i) => [i.id, i.queue_position])))
      }
      return { snap }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSettled: () => settle(qc),
  })
}

/** Total remaining watch time, in seconds, of queued entries with a known duration. */
export function queueDurations(items: Item[]) {
  let seconds = 0
  let unknown = 0
  for (const i of items) {
    if (i.resource.duration_seconds != null) seconds += i.resource.duration_seconds
    else unknown++
  }
  return { seconds, unknown }
}
