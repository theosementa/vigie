import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ItemStatus, LengthBucket, ResourceType } from '@/lib/api'
import { LENGTH_BUCKETS, RESOURCE_TYPES } from './metadata'

export interface LibraryFilters {
  status: ItemStatus
  /** Several types: an item of any of them. Empty = all types. */
  type: ResourceType[]
  length: LengthBucket | null
  /** Several tags: an item carrying any of them. Empty = no tag filter. */
  tag: string[]
  q: string
}

/** The library filters carried by a URL query (unknown or invalid values fall back to the defaults). */
export function readFilters(params: URLSearchParams): LibraryFilters {
  const types = params.getAll('type')
  const tags: string[] = []
  for (const raw of params.getAll('tag')) {
    const tag = raw.trim()
    if (tag && !tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag)
  }
  return {
    status: params.get('status') === 'seen' ? 'seen' : 'to_watch',
    type: RESOURCE_TYPES.filter((x) => types.includes(x)),
    length: LENGTH_BUCKETS.find((x) => x === params.get('length')) ?? null,
    tag: tags,
    q: params.get('q') ?? '',
  }
}

/**
 * Filters live in the URL (?status=&type=&length=&tag=&q=, `type` and `tag` repeated for several) so they are shared by mobile, sidebar and toolbar.
 * The opened item is `?item=<id>` so any component (add flow, cards) can open one.
 */
export function useLibraryFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => readFilters(params), [params])

  const itemId = params.get('item')

  const update = useCallback(
    (patch: Partial<Record<'status' | 'type' | 'length' | 'tag' | 'q' | 'item', string | readonly string[] | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            next.delete(k)
            if (Array.isArray(v)) v.forEach((x) => next.append(k, x))
            else if (!(v === null || v === '' || v === 'all' || (k === 'status' && v === 'to_watch'))) next.set(k, v as string)
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
