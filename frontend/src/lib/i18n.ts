import { useSyncExternalStore } from 'react'
import { en } from '@/i18n/en'
import { fr } from '@/i18n/fr'

/** The locales the app is translated into. */
export type Locale = 'en' | 'fr'
/** What the user stores: a locale, or `auto` (follow the browser). */
export type LocalePreference = Locale | 'auto'

export type MessageKey = keyof typeof en
/** `foo` for the plural pair `foo_one` / `foo_other`. */
type PluralKey<K extends string> = K extends `${infer B}_one` ? B : never
export type TranslationKey = MessageKey | PluralKey<MessageKey>
export type Params = Record<string, string | number>

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, fr }

/** `auto` follows the browser: French when it asks for French, English otherwise. */
export function resolveLocale(preference: LocalePreference | undefined): Locale {
  if (preference === 'en' || preference === 'fr') return preference
  const lang = typeof navigator === 'undefined' ? '' : (navigator.language ?? '')
  return lang.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export const LOCALE_STORAGE_KEY = 'vigie-locale'

function storedPreference(): LocalePreference {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    return v === 'en' || v === 'fr' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Remember the preference so the next visit starts in the right language before /me answers. */
export function rememberLocalePreference(preference: LocalePreference) {
  try {
    if (preference === 'auto') localStorage.removeItem(LOCALE_STORAGE_KEY)
    else localStorage.setItem(LOCALE_STORAGE_KEY, preference)
  } catch {
    // storage unavailable: the server-side preference still applies after login
  }
}

let current: Locale = resolveLocale(storedPreference())
if (typeof document !== 'undefined') document.documentElement.lang = current
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

/** Switch the UI language: re-renders `useT()` users and keeps `<html lang>` in sync. */
export function setLocale(next: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = next
  if (next === current) return
  current = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** BCP 47 tag handed to `Intl`. */
export function intlLocale(locale: Locale): string {
  return locale === 'fr' ? 'fr-FR' : 'en-GB'
}

function interpolate(message: string, params?: Params): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Translate `key`. `{name}` placeholders take their value from `params`. With a numeric `count`,
 * the plural variant `key_one` / `key_other` (whatever `Intl.PluralRules` selects) is used.
 */
export function translate(locale: Locale, key: TranslationKey, params?: Params): string {
  const dict = DICTIONARIES[locale] as Record<string, string>
  if (typeof params?.count === 'number') {
    const category = new Intl.PluralRules(intlLocale(locale)).select(params.count)
    const message = dict[`${key}_${category}`] ?? dict[`${key}_other`]
    if (message !== undefined) return interpolate(message, params)
  }
  return interpolate(dict[key] ?? key, params)
}

/** Translate in the current locale, for code outside React. */
export function t(key: TranslationKey, params?: Params): string {
  return translate(current, key, params)
}

export type TFunction = typeof t

/** The translate function bound to the current locale; components re-render when it changes. */
export function useT(): TFunction {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale)
  // One function per locale, so it is a stable dependency for useMemo/useEffect.
  return TRANSLATORS[locale]
}

const TRANSLATORS: Record<Locale, TFunction> = {
  en: (key, params) => translate('en', key, params),
  fr: (key, params) => translate('fr', key, params),
}

/** The current locale as a value (formatters, `lang` attributes). */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale)
}
