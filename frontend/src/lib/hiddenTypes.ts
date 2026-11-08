import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meKey, useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { ResourceType, User } from '@/lib/api'

const NONE: ResourceType[] = []

/** The resource types this user chose not to see offered. Kept on the account, so it follows them across devices. */
export function useHiddenTypes(): [ResourceType[], (next: ResourceType[]) => void] {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const set = useCallback(
    (next: ResourceType[]) => {
      // Optimistic: the switches must answer at once, like the theme does.
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, hidden_types: next } : u))
      mutate({ hidden_types: next })
    },
    [qc, mutate],
  )
  return [me?.hidden_types ?? NONE, set]
}
