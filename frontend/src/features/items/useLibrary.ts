import { useCallback, useMemo } from 'react'
import type { Item } from '@/lib/api'
import { useItem, useItems, type ItemsFilter } from './queries'
import { useLibraryFilters } from './useLibraryFilters'

export function useLibrary(sharedOnly: boolean) {
  const { filters, update, itemId } = useLibraryFilters()

  const filter: ItemsFilter = useMemo(
    () => ({
      status: filters.status,
      type: filters.type.length ? filters.type : undefined,
      length: filters.length ?? undefined,
      tag: filters.tag.length ? filters.tag : undefined,
      q: filters.q.trim() || undefined,
      shared: sharedOnly ? true : undefined,
    }),
    [filters, sharedOnly],
  )

  const query = useItems(filter)
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])

  // Same on every page; null when no length is filtered.
  const lengthUnknown = query.data?.pages[0]?.length_unknown ?? null

  const detail = useItem(itemId)
  const selected: Item | null = detail.isError ? null : (detail.data ?? null)

  const open = useCallback((item: Item) => update({ item: item.id }), [update])
  const close = useCallback(() => update({ item: null }), [update])

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refetch: () => query.refetch(),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
    lengthUnknown,
    sharedOnly,
    hasActiveFilters:
      filters.type.length > 0 || filters.length !== null || filters.tag.length > 0 || filters.q.trim() !== '',
    filters,
    update,
    selected,
    open,
    close,
  }
}

export type Library = ReturnType<typeof useLibrary>
