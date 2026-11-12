import { Link, Outlet, matchPath, useLocation } from 'react-router-dom'
import { useRealtime } from '@/features/realtime/useRealtime'
import { Icon } from '@/components/Icon'
import { useMe } from '@/features/auth/useAuth'
import { contactLabel, useContacts } from '@/features/contacts/queries'
import { CaptureBar } from '@/features/items/CaptureBar'
import { setSearchOpen, useSearchOpen } from '@/features/items/searchOpen'
import { useLibraryFilters } from '@/features/items/useLibraryFilters'
import { usePile } from '@/features/stats/queries'
import { formatDayLong, formatNumber } from '@/lib/format'
import { useT, type MessageKey } from '@/lib/i18n'
import { Rail, Sidebar, TabBar } from './Navigation'
import { entryFor, isLibraryPath } from './nav'

/** The server could not be reached but a session is cached: say so instead of logging the user out. */
function OfflineNotice() {
  const t = useT()
  const { data: me, isError } = useMe()
  if (!me || !isError) return null
  return (
    <div role="status" className="notice">
      <Icon name="cloud-cross" />
      {t('offline.notice')}
    </div>
  )
}

/** Sub-title of the Library header: « 87 à voir · jeudi 5 novembre » from live data. */
function LibrarySub() {
  const t = useT()
  const { pile } = usePile()
  const date = formatDayLong()
  return <p>{pile ? t('library.sub', { count: pile.count, formatted: formatNumber(pile.count), date }) : date}</p>
}

/** Search button of the phone header: opens the search field under it, closes and clears it. */
function SearchButton() {
  const t = useT()
  const open = useSearchOpen()
  const { filters, update } = useLibraryFilters()
  const active = open || filters.q !== ''
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t('search.label')}
      title={t('search.label')}
      aria-pressed={active}
      onClick={() => {
        if (active) {
          setSearchOpen(false)
          update({ q: null })
        } else setSearchOpen(true)
      }}
    >
      <Icon name={active ? 'magnifier-close' : 'magnifier'} small />
    </button>
  )
}

/** Title of a contact's history: its name, or the address. */
function ContactName({ id }: { id: string }) {
  const { data } = useContacts()
  const contact = data?.find((c) => c.id === id)
  return <>{contact ? contactLabel(contact) : ''}</>
}

/** Where the back button of a sub-screen goes, with the label of its destination. */
function backTarget(pathname: string): { to: string; label: MessageKey } | null {
  if (pathname === '/settings') return { to: '/', label: 'nav.library' }
  if (pathname === '/admin') return { to: '/settings', label: 'nav.settings' }
  if (pathname === '/contacts') return { to: '/shared', label: 'nav.shared' }
  if (pathname.startsWith('/contacts/')) return { to: '/contacts', label: 'nav.contacts' }
  return null
}

/** Screen title: DA screen header on a phone (back, search and settings buttons), main header on tablet and desktop. */
function PageHeader() {
  const t = useT()
  const { pathname } = useLocation()
  const entry = entryFor(pathname)
  const thread = matchPath('/contacts/:id', pathname)
  const isContacts = pathname === '/contacts' || thread !== null
  const title = thread?.params.id ? (
    <ContactName id={thread.params.id} />
  ) : (
    t(pathname === '/contacts' ? 'title.contacts' : (entry?.title ?? 'shell.logo'))
  )
  const back = backTarget(pathname)
  const library = isLibraryPath(pathname)
  const narrow = pathname === '/settings' ? '3xl' : isContacts ? 'xl' : pathname === '/admin' ? '2xl' : null
  return (
    <>
      <header className="scr-h only-mobile">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Link to={back.to} className="icon-btn" aria-label={t(back.label)}>
              <Icon name="alt-arrow-left" small />
            </Link>
          )}
          <h1>{title}</h1>
        </div>
        {library && (
          <div className="icon-btns">
            <SearchButton />
            {pathname === '/shared' && (
              <Link to="/contacts" className="icon-btn" aria-label={t('nav.contacts')} title={t('nav.contacts')}>
                <Icon name="users-group-rounded" small />
              </Link>
            )}
            {pathname === '/' && (
              <Link to="/settings" className="icon-btn" aria-label={t('nav.settings')} title={t('nav.settings')}>
                <Icon name="settings" small />
              </Link>
            )}
          </div>
        )}
      </header>
      <header className={`main-h only-desktop${narrow ? ` main-h-narrow main-h-${narrow}` : ''}`}>
        <div>
          <div className="flex min-w-0 items-center gap-3">
            {isContacts && back && (
              <Link to={back.to} className="icon-btn" aria-label={t(back.label)}>
                <Icon name="alt-arrow-left" small />
              </Link>
            )}
            <h1>{title}</h1>
          </div>
          {pathname === '/' && <LibrarySub />}
          {pathname === '/shared' && (
            <Link to="/contacts" className="btn btn-2 btn-sm mt-3 inline-flex">
              <Icon name="users-group-rounded" small />
              {t('nav.contacts')}
            </Link>
          )}
        </div>
        {library && <CaptureBar />}
      </header>
    </>
  )
}

/** One shell, three designs (blueprint 04): tab bar < 768 px, icon rail 768-1023 px, sidebar >= 1024 px. */
export function AppShell() {
  const { pathname } = useLocation()
  useRealtime()
  return (
    <div className="app">
      <Sidebar />
      <Rail />
      <main className="main">
        <OfflineNotice />
        <PageHeader />
        <div key={pathname} className="main-body page-in">
          <Outlet />
        </div>
      </main>
      <TabBar />
    </div>
  )
}
