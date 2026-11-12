import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useAddItem } from '@/features/items/addItemContext'
import { SidebarViews } from '@/features/views/SidebarViews'
import { useActiveView } from '@/features/views/queries'
import { useMe } from '@/features/auth/useAuth'
import { fullName, initials } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { ADMIN_ENTRY, NAV, SETTINGS_ENTRY, isEntryActive, type NavEntry } from './nav'
import { useNavCounts } from './useNavCounts'

/** A NavLink that also knows Contacts belong to Shared (see `isEntryActive`). */
function NavItem({
  entry,
  className,
  current,
  children,
  ...rest
}: {
  entry: NavEntry
  className?: string
  /** Overrides the path-based answer (Library gives way to the view selected under it). */
  current?: boolean
  children: (isActive: boolean) => ReactNode
  'aria-label'?: string
  title?: string
}) {
  const { pathname } = useLocation()
  const active = current ?? isEntryActive(entry, pathname)
  return (
    <Link
      to={entry.to}
      className={[className, active && 'active'].filter(Boolean).join(' ') || undefined}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {children(active)}
    </Link>
  )
}

/** Phone: 4 tabs around the central round "add" action. Active tab = bold icon + text colour. */
export function TabBar() {
  const t = useT()
  const { open } = useAddItem()
  const [library, queue, shared, stats] = NAV
  const tab = (entry: NavEntry) => (
    <NavItem key={entry.to} entry={entry} className="tab">
      {(isActive) => (
        <>
          <Icon name={entry.icon} bold={isActive} />
          {t(entry.label)}
        </>
      )}
    </NavItem>
  )
  return (
    <nav className="tabbar only-mobile" aria-label={t('nav.main')}>
      {tab(library)}
      {tab(queue)}
      <div className="tab-start">
        <button type="button" className="start" aria-label={t('nav.add.label')} title={t('nav.add.label')} onClick={() => open()}>
          <Icon name="add" />
        </button>
      </div>
      {tab(shared)}
      {tab(stats)}
    </nav>
  )
}

/** Tablet portrait (768-1023 px): 72 px icon rail, labels in aria-label + title. */
export function Rail() {
  const t = useT()
  const { open } = useAddItem()
  const { data: me } = useMe()
  const counts = useNavCounts()
  const badge: Record<string, string | null> = { '/queue': counts.queue }
  const link = (entry: NavEntry) => (
    <NavItem
      key={entry.to}
      entry={entry}
      className="rail-link"
      aria-label={t(entry.label)}
      title={t(entry.label)}
    >
      {(isActive) => (
        <>
          <Icon name={entry.icon} bold={isActive} />
          {badge[entry.to] && badge[entry.to] !== '0' && <span className="badge-n">{badge[entry.to]}</span>}
        </>
      )}
    </NavItem>
  )
  return (
    <aside className="rail only-desktop" aria-label={t('nav.main')}>
      <button type="button" className="start" aria-label={t('nav.add.label')} title={t('nav.add.label')} onClick={() => open()}>
        <Icon name="add" />
      </button>
      <nav className="rail-nav" aria-label={t('nav.main')}>
        {NAV.map(link)}
      </nav>
      <div className="rail-foot">
        {link(SETTINGS_ENTRY)}
        {me?.role === 'admin' && link(ADMIN_ENTRY)}
      </div>
    </aside>
  )
}

/** Desktop (>= 1024 px): 232 px sidebar with counts, settings, admin and the user block. */
export function Sidebar() {
  const t = useT()
  const { data: me } = useMe()
  const counts = useNavCounts()
  const viewSelected = useActiveView() !== undefined

  const count: Record<string, React.ReactNode> = {
    '/': counts.toWatch,
    '/queue': counts.queue,
    '/shared': counts.sharedCount > 0 ? (
      <>
        <span className="dot" aria-hidden="true" />
        {counts.shared}
      </>
    ) : null,
  }
  const link = (entry: NavEntry) => (
    <NavItem key={entry.to} entry={entry} current={entry.end && viewSelected ? false : undefined}>
      {(isActive) => (
        <>
          <Icon name={entry.icon} small bold={isActive} />
          {t(entry.sideLabel ?? entry.label)}
          {count[entry.to] != null && <span className="n">{count[entry.to]}</span>}
        </>
      )}
    </NavItem>
  )

  return (
    <aside className="side only-desktop" aria-label={t('nav.main')}>
      <nav className="nav" aria-label={t('nav.main')}>
        {NAV.map(link)}
        <SidebarViews />
        <div className="nav-sep" />
        {link(SETTINGS_ENTRY)}
        {me?.role === 'admin' && link(ADMIN_ENTRY)}
      </nav>
      {me && (
        <div className="me">
          <span className="av" aria-hidden="true">{initials(me)}</span>
          <div className="me-text">
            <b>{fullName(me)}</b>
            <span>{t(me.role === 'admin' ? 'role.admin' : 'role.user')}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
