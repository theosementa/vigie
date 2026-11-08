import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meKey, useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { User } from '@/lib/api'

/** Whether sharing saves every recipient as a contact without asking. Kept on the account (on by default). */
export function useAutoCreateContacts(): [boolean, (next: boolean) => void] {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const set = useCallback(
    (next: boolean) => {
      // Optimistic: the switch must answer at once, like the type switches do.
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, auto_create_contacts: next } : u))
      mutate({ auto_create_contacts: next })
    },
    [qc, mutate],
  )
  return [me?.auto_create_contacts ?? true, set]
}
