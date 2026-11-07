import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateMeInput,
  type User,
} from '@/lib/api'
import { statsKey } from '@/features/stats/queries'

export const meKey = ['auth', 'me'] as const

/** Current user (null when logged out). */
export function useMe() {
  return useQuery<User | null>({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api.auth.me()
      } catch {
        return null
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'Modification non enregistrée. Réessaie.' },
    mutationFn: (input: UpdateMeInput) => api.auth.updateMe(input),
    onSuccess: (user) => {
      qc.setQueryData(meKey, user)
      // Buckets (days, weeks, streaks) depend on the time zone.
      qc.invalidateQueries({ queryKey: statsKey })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      qc.setQueryData(meKey, null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
    },
  })
}

/** Drop every cached query: the session is gone (logout everywhere, account deleted). */
function useClearSession() {
  const qc = useQueryClient()
  return () => {
    qc.clear()
    qc.setQueryData(meKey, null)
  }
}

export function useLogoutAll() {
  const clear = useClearSession()
  return useMutation({
    mutationFn: () => api.auth.logoutAll(),
    onSuccess: clear,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.auth.changePassword(input),
  })
}

export function useDeleteAccount() {
  const clear = useClearSession()
  return useMutation({
    mutationFn: (password: string) => api.auth.deleteMe(password),
    onSuccess: clear,
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => api.auth.resetPassword(input),
  })
}
