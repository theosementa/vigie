import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  api,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateMeInput,
  type User,
} from '@/lib/api'
import { clearApiCache } from '@/lib/session'
import { useT } from '@/lib/i18n'
import { statsKey } from '@/features/stats/queries'

export const meKey = ['auth', 'me'] as const
export const sessionsKey = ['auth', 'sessions'] as const

/**
 * Current user: `null` when logged out (a 401). Any other failure (server or network down) is an
 * error, not a logout: the cached user stays in `data` with `isError` set, and the shell shows an
 * offline notice instead of sending the user to /login.
 */
export function useMe() {
  return useQuery<User | null>({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api.auth.me()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
    // Offline is what this query must report, not wait out.
    networkMode: 'always',
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
  const t = useT()
  return useMutation({
    meta: { errorMessage: t('error.save_failed') },
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
      void clearApiCache()
    },
  })
}

/** Drop every cached query: the session is gone (logout everywhere, account deleted). */
export function useClearSession() {
  const qc = useQueryClient()
  return () => {
    qc.clear()
    qc.setQueryData(meKey, null)
    void clearApiCache()
  }
}

/** The devices signed in to this account (refreshed live when one signs in or out). */
export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: () => api.auth.sessions(), staleTime: 60_000 })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.auth.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKey }),
  })
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
