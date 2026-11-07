import { Link, Outlet, useLocation } from 'react-router-dom'
import { useRealtime } from '@/features/realtime/useRealtime'
import { Icon } from '@/components/Icon'
import { useMe } from '@/features/auth/useAuth'
import { CaptureBar } from '@/features/items/CaptureBar'
import { setSearchOpen, useSearchOpen } from '@/features/items/searchOpen'
import { useLibraryFilters } from '@/features/items/useLibraryFilters'
import { usePile } from '@/features/stats/queries'
import { formatDayLong, formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
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

/** Screen title: DA screen header on a phone (back, search and settings buttons), main header on tablet and desktop. */
function PageHeader() {
  const t = useT()
  const { pathname } = useLocation()
  const entry = entryFor(pathname)
  const title = t(entry?.title ?? 'shell.logo')
  const back = pathname === '/settings' ? '/' : pathname === '/admin' ? '/settings' : null
  const library = isLibraryPath(pathname)
  const narrow = pathname === '/settings' ? 'xl' : pathname === '/admin' ? '2xl' : null
  return (
    <>
      <header className="scr-h only-mobile">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Link to={back} className="icon-btn" aria-label={t(back === '/' ? 'nav.library' : 'nav.settings')}>
              <Icon name="alt-arrow-left" small />
            </Link>
          )}
          <h1>{title}</h1>
        </div>
        {library && (
          <div className="icon-btns">
            <SearchButton />
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
          <h1>{title}</h1>
          {pathname === '/' && <LibrarySub />}
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
