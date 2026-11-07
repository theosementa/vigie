import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type User } from '@/lib/api'
import { browserTimeZone } from '@/lib/timezone'
import { statsKey } from '@/features/stats/queries'
import { meKey } from './useAuth'

/**
 * Accounts start in 'UTC' (e.g. created before time zones existed). Once per user, if the browser
 * is elsewhere, silently adopt the browser zone. Failures are ignored; the user can still set it in Réglages.
 */
export function useTimezoneSync(me: User | null | undefined) {
  const qc = useQueryClient()
  const attempted = useRef(false)

  useEffect(() => {
    if (!me || attempted.current) return
    const tz = browserTimeZone()
    if (me.timezone !== 'UTC' || tz === 'UTC') return
    const flag = `radar.tz-synced.${me.id}`
    try {
      if (localStorage.getItem(flag)) return
    } catch {
      // storage unavailable: the in-memory ref still limits this to one attempt per session
    }
    attempted.current = true
    api.auth
      .updateMe({ timezone: tz })
      .then((user) => {
        try {
          localStorage.setItem(flag, '1')
        } catch {
          // ignore
        }
        qc.setQueryData(meKey, user)
        qc.invalidateQueries({ queryKey: statsKey })
      })
      .catch(() => {})
  }, [me, qc])
}
