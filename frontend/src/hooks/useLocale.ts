import { useCallback, useEffect } from 'react'
import { useMe, useUpdateMe } from '@/features/auth/useAuth'
import type { Locale as LocalePreference } from '@/lib/api'
import { rememberLocalePreference, resolveLocale, setLocale } from '@/lib/i18n'

/** Once `/me` is loaded, the account's language (`auto` follows the browser) drives the UI. */
export function useLocaleFromUser() {
  const { data: me } = useMe()
  const preference = me?.locale
  useEffect(() => {
    if (!preference) return
    rememberLocalePreference(preference)
    setLocale(resolveLocale(preference))
  }, [preference])
}

/** Current language preference and its setter (applies at once, then saves with PATCH /auth/me). */
export function useLocalePreference(): {
  preference: LocalePreference
  setPreference: (preference: LocalePreference) => void
} {
  const { data: me } = useMe()
  const { mutate } = useUpdateMe()
  const setPreference = useCallback(
    (next: LocalePreference) => {
      rememberLocalePreference(next)
      setLocale(resolveLocale(next))
      mutate({ locale: next })
    },
    [mutate],
  )
  return { preference: me?.locale ?? 'auto', setPreference }
}
