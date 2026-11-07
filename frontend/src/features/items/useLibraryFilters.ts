import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ItemStatus, ResourceType } from '@/lib/api'
import { RESOURCE_TYPES } from './metadata'

export interface LibraryFilters {
  status: ItemStatus
  type: ResourceType | 'all'
  tag: string | null
  q: string
}

/**
 * Filters live in the URL (?status=&type=&tag=&q=) so they are shared by mobile, sidebar and toolbar.
 * The opened item is `?item=<id>` so any component (add flow, cards) can open one.
 */
export function useLibraryFilters() {
  const [params, setParams] = useSearchParams()

  const filters: LibraryFilters = useMemo(() => {
    const status = params.get('status') === 'seen' ? 'seen' : 'to_watch'
    const t = params.get('type')
    return {
      status,
      type: RESOURCE_TYPES.find((x) => x === t) ?? 'all',
      tag: params.get('tag'),
      q: params.get('q') ?? '',
    }
  }, [params])

  const itemId = params.get('item')

  const update = useCallback(
    (patch: Partial<Record<'status' | 'type' | 'tag' | 'q' | 'item', string | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || v === 'all' || (k === 'status' && v === 'to_watch'))
              next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { filters, update, itemId }
}
