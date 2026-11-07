import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { meKey, sessionsKey, useClearSession, useMe } from '@/features/auth/useAuth'
import { itemsKey, queueKey, tagsKey } from '@/features/items/queries'
import { statsKey } from '@/features/stats/queries'

const KEYS: Record<string, readonly unknown[]> = {
  items: itemsKey,
  queue: queueKey,
  tags: tagsKey,
  stats: statsKey,
  me: meKey,
  sessions: sessionsKey,
}

/** Refetch what the server says changed on another device ("*" = everything). */
function invalidate(qc: QueryClient, topics: string[]) {
  if (topics.includes('*')) {
    void qc.invalidateQueries()
    return
  }
  for (const topic of topics) {
    const key = KEYS[topic]
    if (key) void qc.invalidateQueries({ queryKey: key })
  }
}

/**
 * Live updates: one Server-Sent Events connection to /api/stream while signed in. When another
 * device (or tab) adds, edits or removes something, the matching queries refetch; when this
 * device is signed out from another one, the session is dropped at once.
 *
 * The browser reconnects by itself; after a gap (sleep, network loss, tab brought back) everything
 * is refetched once, since events sent meanwhile are not replayed.
 */
export function useRealtime() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const clearSession = useClearSession()
  const signedIn = Boolean(me)

  useEffect(() => {
    if (!signedIn || typeof EventSource === 'undefined') return
    const source = new EventSource('/api/stream')
    let opened = false

    source.addEventListener('ready', () => {
      if (opened) invalidate(qc, ['*']) // reconnected: catch up
      opened = true
    })
    source.addEventListener('sync', (e) => {
      try {
        invalidate(qc, (JSON.parse((e as MessageEvent<string>).data) as { topics: string[] }).topics)
      } catch {
        invalidate(qc, ['*'])
      }
    })
    source.addEventListener('revoked', () => {
      source.close()
      clearSession()
    })
    source.onerror = () => {
      // CLOSED = the browser gave up (e.g. a 401): ask /me, which sends the user to the login page.
      if (source.readyState === EventSource.CLOSED) void qc.invalidateQueries({ queryKey: meKey })
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && opened) invalidate(qc, ['*'])
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      source.close()
    }
  }, [signedIn, qc, clearSession])
}
