import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meKey, useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { MobileLayout, User } from '@/lib/api'

export type { MobileLayout }

/** How the library is shown on a phone. Kept on the account, so it follows the user across devices. */
export function useMobileLayout(): [MobileLayout, (next: MobileLayout) => void] {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const set = useCallback(
    (next: MobileLayout) => {
      // Optimistic: the segmented control must answer at once, like the theme does.
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, mobile_layout: next } : u))
      mutate({ mobile_layout: next })
    },
    [qc, mutate],
  )
  return [me?.mobile_layout ?? 'list', set]
}

/** How the library is shown on desktop and tablet (card grid by default). Also kept on the account. */
export function useDesktopLayout(): [MobileLayout, (next: MobileLayout) => void] {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const set = useCallback(
    (next: MobileLayout) => {
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, desktop_layout: next } : u))
      mutate({ desktop_layout: next })
    },
    [qc, mutate],
  )
  return [me?.desktop_layout ?? 'grid', set]
}
