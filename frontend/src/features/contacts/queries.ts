/** Data hooks for the private address book and the history of each contact. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Contact } from '@/lib/api'
import { t } from '@/lib/i18n'

export const contactsKey = ['contacts'] as const
export const contactHistoryKey = (id: string) => ['contacts', 'history', id] as const

/** What to show for a contact: the name its owner typed, else the address. */
export function contactLabel(c: Pick<Contact, 'name' | 'email'>): string {
  return c.name || c.email
}

/** Most recent activity first, as the server sorts them. */
export function useContacts() {
  return useQuery({ queryKey: contactsKey, queryFn: api.contacts.list, staleTime: 30_000 })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('contacts.create.error') },
    mutationFn: (input: { email: string; name?: string | null }) => api.contacts.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKey }),
  })
}

export function useRenameContact() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('contacts.rename.error') },
    mutationFn: ({ id, name }: { id: string; name: string | null }) => api.contacts.rename(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKey }),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: t('contacts.delete.error') },
    mutationFn: (id: string) => api.contacts.remove(id),
    onSuccess: (_res, id) => {
      qc.setQueryData<Contact[]>(contactsKey, (list) => list?.filter((c) => c.id !== id))
      qc.removeQueries({ queryKey: contactHistoryKey(id) })
      qc.invalidateQueries({ queryKey: contactsKey })
    },
  })
}

/** Newest page first; `fetchNextPage` loads older entries. */
export function useContactHistory(id: string) {
  return useInfiniteQuery({
    queryKey: contactHistoryKey(id),
    queryFn: ({ pageParam }) => api.contacts.history(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_before ?? undefined,
    staleTime: 30_000,
  })
}
