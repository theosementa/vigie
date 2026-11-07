import { useCallback, useEffect } from 'react'
import { useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { Theme } from '@/lib/api'
import { applyTheme, readStoredTheme, syncThemeColor } from '@/lib/theme'

/** Follow the OS scheme while the theme is "system": the browser chrome colour must track it. */
export function useThemeColorSync() {
  useEffect(() => {
    syncThemeColor()
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', syncThemeColor)
    return () => mql.removeEventListener('change', syncThemeColor)
  }, [])
}

/** Once `/me` is loaded, the server-side preference wins over the one remembered in localStorage. */
export function useThemeFromUser() {
  const { data: me } = useMe()
  const theme = me?.theme
  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])
}

/** Current theme preference and its setter (applies at once, then saves with PATCH /auth/me). */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next)
      mutate({ theme: next })
    },
    [mutate],
  )
  return { theme: me?.theme ?? readStoredTheme(), setTheme }
}
