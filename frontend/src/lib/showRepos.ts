import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meKey, useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { User } from '@/lib/api'

/** Whether the "Repository" type is offered. Kept on the account, so it follows the user across devices. */
export function useShowRepos(): [boolean, (next: boolean) => void] {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const set = useCallback(
    (next: boolean) => {
      // Optimistic: the switch must answer at once, like the theme does.
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, show_repos: next } : u))
      mutate({ show_repos: next })
    },
    [qc, mutate],
  )
  return [me?.show_repos ?? true, set]
}
