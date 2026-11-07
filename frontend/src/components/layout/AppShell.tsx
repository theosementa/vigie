import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useMe } from '@/features/auth/useAuth'
import { LibraryToolbar } from '@/features/items/desktop/LibraryToolbar'
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

/** Screen title: DA screen header on a phone (back or settings icon), main header on tablet and desktop. */
function PageHeader() {
  const t = useT()
  const { pathname } = useLocation()
  const entry = entryFor(pathname)
  const title = t(entry?.title ?? 'shell.logo')
  const back = pathname === '/settings' ? '/' : pathname === '/admin' ? '/settings' : null
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
        {pathname === '/' && (
          <div className="icon-btns">
            <Link to="/settings" className="icon-btn" aria-label={t('nav.settings')} title={t('nav.settings')}>
              <Icon name="settings" small />
            </Link>
          </div>
        )}
      </header>
      <header className="main-h only-desktop">
        <h1>{title}</h1>
        {isLibraryPath(pathname) && (
          <div className="capture">
            <LibraryToolbar />
          </div>
        )}
      </header>
    </>
  )
}

/** One shell, three designs (blueprint 04): tab bar < 768 px, icon rail 768-1023 px, sidebar >= 1024 px. */
export function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <Rail />
      <main className="main">
        <OfflineNotice />
        <PageHeader />
        <div className="main-body">
          <Outlet />
        </div>
      </main>
      <TabBar />
    </div>
  )
}
