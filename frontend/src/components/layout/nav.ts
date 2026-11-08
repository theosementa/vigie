import type { IconBase } from '@/components/Icon'
import type { MessageKey } from '@/lib/i18n'

export interface NavEntry {
  to: string
  icon: IconBase
  /** Match the path exactly (the library lives at "/"). */
  end?: boolean
  /** Label under a tab, and in the rail's tooltip */
  label: MessageKey
  /** Label in the desktop sidebar (defaults to `label`) */
  sideLabel?: MessageKey
  /** Screen title */
  title: MessageKey
}

/** The four destinations of the tab bar, rail and sidebar (the add action sits between them on a phone). */
export const NAV: NavEntry[] = [
  { to: '/', icon: 'layers-minimalistic', end: true, label: 'nav.library', title: 'title.library' },
  { to: '/queue', icon: 'playlist-minimalistic', label: 'nav.queue', title: 'title.queue' },
  { to: '/shared', icon: 'plain', label: 'nav.shared', title: 'title.shared' },
  { to: '/stats', icon: 'radar-2', label: 'nav.stats', sideLabel: 'title.stats', title: 'title.stats' },
]

export const SETTINGS_ENTRY: NavEntry = {
  to: '/settings',
  icon: 'settings',
  label: 'nav.settings',
  title: 'title.settings',
}

/** Admin-only entry: sidebar and rail (a phone reaches it from the settings screen). */
export const ADMIN_ENTRY: NavEntry = {
  to: '/admin',
  icon: 'users-group-rounded',
  label: 'nav.admin',
  title: 'title.admin',
}

/** Active entry for the tab bar, rail and sidebar. Contacts live under Shared, which stays lit there. */
export function isEntryActive(entry: NavEntry, pathname: string): boolean {
  if (entry.end) return pathname === entry.to
  if (entry.to === '/shared' && (pathname === '/contacts' || pathname.startsWith('/contacts/'))) return true
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`)
}

export function entryFor(pathname: string): NavEntry | undefined {
  // Contacts live under Shared: that tab stays lit while you are there.
  if (pathname.startsWith('/contacts')) return NAV.find((n) => n.to === '/shared')
  return [...NAV, SETTINGS_ENTRY, ADMIN_ENTRY].find((n) =>
    n.end ? pathname === n.to : pathname.startsWith(n.to),
  )
}

/** Library and "shared with me" are the item lists; they carry the toolbar on desktop. */
export function isLibraryPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/shared')
}
