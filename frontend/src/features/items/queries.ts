/** Data hooks for items and tags, backed by the real API (src/lib/api.ts). */
import { useCallback } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ApiError,
  api,
  type CreateItemInput,
  type Item,
  type ItemsPage,
  type LengthBucket,
  type QueueList,
  type ItemStatus,
  type ResourceType,
  type ShareInput,
  type TagWithCount,
  type UpdateItemInput,
} from '@/lib/api'
import { t } from '@/lib/i18n'
import { contactsKey } from '@/features/contacts/queries'
import { statsKey } from '@/features/stats/queries'
import { usePendingDeletes } from './pendingDeletes'

export const PAGE_SIZE = 24

export interface ItemsFilter {
  status?: ItemStatus
  type?: ResourceType
  length?: LengthBucket
  tag?: string
  q?: string
  shared?: boolean
}

export const itemsKey = ['items'] as const
export const itemsListKey = ['items', 'list'] as const
export const itemKey = (id: string) => ['items', 'detail', id] as const
export const eventsKey = (id: string) => ['items', 'events', id] as const
export const tagsKey = ['tags'] as const
export const queueKey = ['queue'] as const

type ListData = InfiniteData<ItemsPage, string | undefined>

/** Server-side filtered, cursor-paginated list. */
export function useItems(filter: ItemsFilter) {
  const pending = usePendingDeletes()
  const select = useCallback(
    (data: ListData): ListData =>
      pending.size === 0
        ? data
        : { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => !pending.has(i.id)) })) },
    [pending],
  )
  return useInfiniteQuery({
    select,
    queryKey: [...itemsListKey, filter],
    queryFn: ({ pageParam }) => api.items.list({ ...filter, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 30_000,
  })
}

/** Single item (used for the selected item, independent from loaded pages). */
export function useItem(id: string | null) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: itemKey(id ?? ''),
    queryFn: () => api.items.get(id!),
    enabled: id !== null,
    placeholderData: () => (id ? findInLists(qc, id) : undefined),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  })
}

/** The item's journal (added, seen, unseen, shared), oldest first. */
export function useItemEvents(id: string) {
  return useQuery({
    queryKey: eventsKey(id),
    queryFn: () => api.items.events(id),
    staleTime: 15_000,
  })
}

export function useTags() {
  return useQuery<TagWithCount[]>({
    queryKey: tagsKey,
    queryFn: () => api.tags.list(),
    staleTime: 60_000,
  })
}

// ---------- cache helpers ----------

function findInLists(qc: QueryClient, id: string): Item | undefined {
  for (const [, data] of qc.getQueriesData<ListData>({ queryKey: itemsListKey })) {
    for (const page of data?.pages ?? []) {
      const found = page.items.find((i) => i.id === id)
      if (found) return found
    }
  }
  return undefined
}

export function mapLists(qc: QueryClient, fn: (items: Item[], filter: ItemsFilter) => Item[]) {
  for (const [key, data] of qc.getQueriesData<ListData>({ queryKey: itemsListKey })) {
    if (!data) continue
    const filter = key[2] as ItemsFilter
    qc.setQueryData<ListData>(key, {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: fn(p.items, filter) })),
    })
  }
}

export function putItem(qc: QueryClient, item: Item) {
  mapLists(qc, (items) => items.map((i) => (i.id === item.id ? item : i)))
  qc.setQueryData(itemKey(item.id), item)
  qc.setQueryData<QueueList>(queueKey, (q) =>
    q ? { items: q.items.map((i) => (i.id === item.id ? item : i)) } : q,
  )
}

export type Snapshot = [readonly unknown[], unknown][]
export function snapshot(qc: QueryClient): Snapshot {
  return [
    ...qc.getQueriesData({ queryKey: itemsKey }),
    ...qc.getQueriesData({ queryKey: queueKey }),
  ]
}
export function restore(qc: QueryClient, snap?: Snapshot) {
  snap?.forEach(([key, data]) => qc.setQueryData(key, data))
}

/** Optimistically drop an item from the cached queue (seen / deleted), closing the gap. */
function dropFromQueue(qc: QueryClient, id: string) {
  qc.setQueryData<QueueList>(queueKey, (q) =>
    q
      ? {
          items: q.items
            .filter((i) => i.id !== id)
            .map((i, idx) => ({ ...i, queue_position: idx })),
        }
      : q,
  )
}

// ---------- mutations ----------

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateItemInput) => api.items.create(input),
    onSuccess: (item) => {
      qc.setQueryData(itemKey(item.id), item)
      qc.invalidateQueries({ queryKey: itemsListKey })
      qc.invalidateQueries({ queryKey: tagsKey })
      qc.invalidateQueries({ queryKey: statsKey })
      if (item.queue_position !== null) qc.invalidateQueries({ queryKey: queueKey })
    },
  })
}

const UNDO_MS = 5000

interface StatusVars {
  id: string
  status: ItemStatus
  /** Text of the Undo toast shown when marking as seen (default: "Marked as seen"). */
  seenMessage?: string
}

export function useSetItemStatus() {
  const qc = useQueryClient()
  const mutation: UseMutationResult<Item, Error, StatusVars, { snap: Snapshot }> = useMutation({
    meta: { errorMessage: t('error.status_failed') },
    mutationFn: ({ id, status }: StatusVars) => api.items.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: itemsKey })
      const snap = snapshot(qc)
      const seen_at = status === 'seen' ? new Date().toISOString() : null
      const patch = (i: Item): Item => (i.id === id ? { ...i, status, seen_at } : i)
      // Leaves the list right away when it is filtered on the other status.
      mapLists(qc, (items, f) =>
        f.status && f.status !== status ? items.filter((i) => i.id !== id) : items.map(patch),
      )
      qc.setQueryData<Item>(itemKey(id), (i) =>
        i ? { ...patch(i), ...(status === 'seen' && { queue_position: null }) } : i,
      )
      // Marking as seen removes the item from the watch queue (server-side too).
      if (status === 'seen') {
        mapLists(qc, (items) => items.map((i) => (i.id === id ? { ...i, queue_position: null } : i)))
        dropFromQueue(qc, id)
      }
      return { snap }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
    onSuccess: (item, { id, status, seenMessage }) => {
      qc.setQueryData(itemKey(item.id), item)
      if (status === 'seen')
        toast(seenMessage ?? t('item.marked_seen'), {
          duration: UNDO_MS,
          action: {
            label: t('common.undo'),
            onClick: () => mutation.mutate({ id, status: 'to_watch' }),
          },
        })
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: itemsListKey })
      qc.invalidateQueries({ queryKey: queueKey })
      qc.invalidateQueries({ queryKey: statsKey })
      qc.invalidateQueries({ queryKey: eventsKey(id) })
      qc.invalidateQueries({ queryKey: contactsKey }) // new contacts, last-shared dates
    },
  })
  return mutation
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('error.save_failed') },
    mutationFn: ({ id, input }: { id: string; input: UpdateItemInput }) =>
      api.items.update(id, input),
    onSuccess: (item, { input }) => {
      putItem(qc, item)
      if (input.tags !== undefined) qc.invalidateQueries({ queryKey: tagsKey })
      if (input.tags !== undefined || input.type !== undefined)
        qc.invalidateQueries({ queryKey: itemsListKey })
      // A type change can drop the item from the queue (videos only).
      if (input.type !== undefined) qc.invalidateQueries({ queryKey: queueKey })
    },
  })
}

export function useRefreshItem() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('item.refresh.failed') },
    mutationFn: (id: string) => api.items.refresh(id),
    onSuccess: ({ item }) => {
      putItem(qc, item)
      qc.invalidateQueries({ queryKey: statsKey })
    },
  })
}

export function useShareItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ShareInput }) => api.items.share(id, input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: statsKey })
      qc.invalidateQueries({ queryKey: eventsKey(id) })
      qc.invalidateQueries({ queryKey: contactsKey }) // new contacts, last-shared dates
    },
  })
}

/** Refetch everything a deleted item was part of; resolves once the active queries are fresh. */
export function refreshAfterDelete(qc: QueryClient) {
  return Promise.all(
    [itemsListKey, queueKey, tagsKey, statsKey].map((queryKey) => qc.invalidateQueries({ queryKey })),
  )
}

/** Delete an item right away (the « Annuler » of the capture toast) and refresh every list. */
export async function removeItemNow(qc: QueryClient, id: string) {
  await api.items.remove(id)
  qc.removeQueries({ queryKey: itemKey(id) })
  await refreshAfterDelete(qc)
}
