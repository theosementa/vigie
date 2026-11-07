import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { LogoMark } from '@/components/Logo'
import { useAddItem } from '@/features/items/addItemContext'
import { useTags } from '@/features/items/queries'
import { useMe } from '@/features/auth/useAuth'
import { fullName, initials } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ADMIN_ENTRY, NAV, SETTINGS_ENTRY, type NavEntry } from './nav'
import { useNavCounts } from './useNavCounts'

/** Phone: 4 tabs around the central round "add" action. Active tab = bold icon + text colour. */
export function TabBar() {
  const t = useT()
  const { open } = useAddItem()
  const [library, queue, shared, stats] = NAV
  const tab = (entry: NavEntry) => (
    <NavLink key={entry.to} to={entry.to} end={entry.end} className="tab">
      {({ isActive }) => (
        <>
          <Icon name={entry.icon} bold={isActive} />
          {t(entry.label)}
        </>
      )}
    </NavLink>
  )
  return (
    <nav className="tabbar only-mobile" aria-label={t('nav.main')}>
      {tab(library)}
      {tab(queue)}
      <div className="tab-start">
        <button type="button" className="start" aria-label={t('nav.add.label')} title={t('nav.add.label')} onClick={open}>
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
    <NavLink
      key={entry.to}
      to={entry.to}
      end={entry.end}
      className="rail-link"
      aria-label={t(entry.label)}
      title={t(entry.label)}
    >
      {({ isActive }) => (
        <>
          <Icon name={entry.icon} bold={isActive} />
          {badge[entry.to] && badge[entry.to] !== '0' && <span className="badge-n">{badge[entry.to]}</span>}
        </>
      )}
    </NavLink>
  )
  return (
    <aside className="rail only-desktop" aria-label={t('nav.main')}>
      <Link to="/" className="logo" aria-label={t('shell.logo')} title={t('shell.logo')}>
        <LogoMark />
      </Link>
      <button type="button" className="start" aria-label={t('nav.add.label')} title={t('nav.add.label')} onClick={open}>
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
  const { data: tags = [] } = useTags()
  const counts = useNavCounts()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const activeTag = pathname === '/' ? params.get('tag') : null

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
    <NavLink key={entry.to} to={entry.to} end={entry.end}>
      {({ isActive }) => (
        <>
          <Icon name={entry.icon} small bold={isActive} />
          {t(entry.sideLabel ?? entry.label)}
          {count[entry.to] != null && <span className="n">{count[entry.to]}</span>}
        </>
      )}
    </NavLink>
  )

  return (
    <aside className="side only-desktop" aria-label={t('nav.main')}>
      <Link to="/" className="logo">
        <LogoMark />
        {t('shell.logo')}
      </Link>
      <nav className="nav" aria-label={t('nav.main')}>
        {NAV.map(link)}
        <div className="nav-sep" />
        {link(SETTINGS_ENTRY)}
        {me?.role === 'admin' && link(ADMIN_ENTRY)}
      </nav>
      {tags.length > 0 && (
        // Tag filter kept until the library gets its own chips (DA); the DA sidebar has no tag list.
        <nav className="nav" aria-label="Tags">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to={`/?tag=${encodeURIComponent(tag.name)}`}
              aria-current={activeTag === tag.name ? 'page' : undefined}
            >
              <Icon name="hashtag" small />
              <span className={cn('min-w-0 truncate')}>{tag.name}</span>
              <span className="n">{tag.item_count}</span>
            </Link>
          ))}
        </nav>
      )}
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
