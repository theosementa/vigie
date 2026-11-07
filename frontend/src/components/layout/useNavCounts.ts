import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useQueue } from '@/features/queue/queries'
import { itemsKey } from '@/features/items/queries'
import { usePile } from '@/features/stats/queries'

const MAX = 100

/**
 * Counts for the sidebar and the rail: items to watch (exact, from the pile series), queued videos,
 * items shared with me. Shared has no count endpoint, so a page of up to 100 is read and "100+" shown past it.
 * Only fetched from 768 px up: a phone's tab bar carries no counts.
 */
export function useNavCounts() {
  const enabled = useMediaQuery('(min-width: 768px)')
  // The pile (from the journal) is the exact number of items to watch; no page-size cap.
  const { pile } = usePile()
  const shared = useQuery({
    queryKey: [...itemsKey, 'count', 'shared'],
    queryFn: () => api.items.list({ status: 'to_watch', shared: true, limit: MAX }),
    enabled,
    staleTime: 60_000,
  })
  const queue = useQueue()

  const label = (n: number | undefined, more = false) =>
    n === undefined ? null : `${formatNumber(n)}${more ? '+' : ''}`
  return {
    toWatch: label(pile?.count),
    shared: label(shared.data?.items.length, !!shared.data?.next_cursor),
    sharedCount: shared.data?.items.length ?? 0,
    queue: label(queue.data?.items.length),
  }
}
