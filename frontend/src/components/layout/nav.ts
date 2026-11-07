import { BookOpen, ChartColumn, ListVideo, Settings, ShieldCheck, Users, type LucideIcon } from 'lucide-react'

export interface NavEntry {
  to: string
  label: string
  /** Label used in the desktop sidebar */
  sidebarLabel: string
  /** Page title when it differs from `label` (e.g. the mobile tab label is shorter) */
  title?: string
  icon: LucideIcon
  end?: boolean
}

export const NAV: NavEntry[] = [
  { to: '/', label: 'Bibliothèque', sidebarLabel: 'Bibliothèque', icon: BookOpen, end: true },
  {
    to: '/queue',
    label: 'File',
    sidebarLabel: 'File d’attente',
    title: 'File d’attente',
    icon: ListVideo,
  },
  { to: '/shared', label: 'Partagés', sidebarLabel: 'Partagés avec moi', icon: Users },
  { to: '/stats', label: 'Stats', sidebarLabel: 'Statistiques', title: 'Statistiques', icon: ChartColumn },
  { to: '/settings', label: 'Réglages', sidebarLabel: 'Réglages', icon: Settings },
]

/** Admin-only entry: desktop sidebar (mobile reaches it from the settings screen). */
export const ADMIN_ENTRY: NavEntry = {
  to: '/admin',
  label: 'Administration',
  sidebarLabel: 'Administration',
  icon: ShieldCheck,
}

export function titleFor(pathname: string): string {
  const entry = [...NAV, ADMIN_ENTRY].find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  return entry ? (entry.title ?? entry.label) : 'Vigie'
}
