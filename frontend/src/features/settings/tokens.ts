/** Data hooks for the API tokens of the browser extension (created and revoked in Settings). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const tokensKey = ['tokens'] as const

export function useTokens() {
  return useQuery({ queryKey: tokensKey, queryFn: api.tokens.list, staleTime: 60_000 })
}

export function useCreateToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.tokens.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: tokensKey }),
  })
}

export function useRevokeToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.tokens.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tokensKey }),
  })
}
