import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type RegistrationMode } from '@/lib/api'

export const adminKey = ['admin'] as const
const settingsKey = [...adminKey, 'settings'] as const
const invitationsKey = [...adminKey, 'invitations'] as const
const usersKey = [...adminKey, 'users'] as const

export function useAdminSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: () => api.admin.getSettings() })
}

export function useSetRegistrationMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: RegistrationMode) => api.admin.setRegistrationMode(mode),
    onSuccess: (settings) => qc.setQueryData(settingsKey, settings),
  })
}

export function useInvitations() {
  return useQuery({ queryKey: invitationsKey, queryFn: () => api.admin.invitations() })
}

export function useInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => api.admin.invite(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationsKey }),
  })
}

export function useRemoveInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.admin.removeInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationsKey }),
  })
}

export function useAdminUsers() {
  return useQuery({ queryKey: usersKey, queryFn: () => api.admin.users() })
}

export function useRemoveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.admin.removeUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKey })
      // The invitation of a deleted account may still be listed as used.
      qc.invalidateQueries({ queryKey: invitationsKey })
    },
  })
}

export function useResetLink() {
  return useMutation({ mutationFn: (id: string) => api.admin.resetLink(id) })
}
