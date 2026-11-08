/** Data hooks for saved views: named sets of library filters, stored on the account. */
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { usePendingDeletes } from '@/features/items/pendingDeletes'
import { reorder } from '@/features/queue/queries'
import { api, type SavedView } from '@/lib/api'
import { t } from '@/lib/i18n'
import { canonicalQuery } from './query'

export const viewsKey = ['views'] as const

/** The views in the user's order, without those waiting for their Undo toast to end. */
export function useViews() {
  const pending = usePendingDeletes()
  const select = useCallback(
    (views: SavedView[]) => (pending.size === 0 ? views : views.filter((v) => !pending.has(v.id))),
    [pending],
  )
  return useQuery({ queryKey: viewsKey, queryFn: api.views.list, staleTime: 30_000, select })
}

/** The view whose filters are exactly the library's current ones, if any. */
export function useActiveView(): SavedView | undefined {
  const { data: views = [] } = useViews()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const current = canonicalQuery(params)
  return pathname === '/' && current ? views.find((v) => canonicalQuery(v.query) === current) : undefined
}

export function useCreateView() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('view.save.error') },
    mutationFn: (input: { name: string; query: string }) => api.views.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: viewsKey }),
  })
}

export function useRenameView() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('view.rename.error') },
    mutationFn: ({ id, name }: { id: string; name: string }) => api.views.update(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: viewsKey }),
  })
}

/** Move a view to a 0-based position, optimistically so the list never snaps back. */
export function useMoveView() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['views', 'move'],
    meta: { errorMessage: t('view.move.error') },
    mutationFn: ({ id, position }: { id: string; position: number }) => api.views.update(id, { position }),
    onMutate: async ({ id, position }) => {
      await qc.cancelQueries({ queryKey: viewsKey })
      const previous = qc.getQueryData<SavedView[]>(viewsKey)
      if (previous) {
        const moved = reorder(previous, previous.findIndex((v) => v.id === id), position)
        qc.setQueryData<SavedView[]>(viewsKey, moved.map((v, i) => ({ ...v, position: i })))
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(viewsKey, ctx?.previous),
    onSettled: () => {
      // Refetch once the last of several quick moves is done, so the list does not flicker.
      if (qc.isMutating({ mutationKey: ['views', 'move'] }) <= 1) void qc.invalidateQueries({ queryKey: viewsKey })
    },
  })
}
