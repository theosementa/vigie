import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { Hash, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { LibraryToolbar } from '@/features/items/desktop/LibraryToolbar'
import { useTags } from '@/features/items/queries'
import { NAV, titleFor } from './nav'

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { data: tags = [] } = useTags()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const activeTag = pathname === '/' ? params.get('tag') : null

  return (
    <aside
      className={cn(
        'glass sticky top-0 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/70 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'justify-between px-4')}>
        {!collapsed && <span className="text-base font-semibold">Radar</span>}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
        >
          <PanelLeft />
        </Button>
      </div>

      <nav aria-label="Navigation principale" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
        {NAV.filter((n) => n.to !== '/settings').map((n) => (
          <SidebarLink key={n.to} entry={n} collapsed={collapsed} />
        ))}

        {!collapsed && tags.length > 0 && (
          <div className="mt-4">
            <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Tags
            </h2>
            <ul className="space-y-0.5">
              {tags.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/?tag=${encodeURIComponent(t.name)}`}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted',
                      activeTag === t.name && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                    )}
                  >
                    <Hash className="size-4 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t.item_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-4">
          <SidebarLink entry={NAV.find((n) => n.to === '/settings')!} collapsed={collapsed} />
        </div>
      </nav>
    </aside>
  )
}

function SidebarLink({ entry, collapsed }: { entry: (typeof NAV)[number]; collapsed: boolean }) {
  const { to, end, icon: Icon, sidebarLabel } = entry
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? sidebarLabel : undefined}
      aria-label={sidebarLabel}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
          collapsed && 'justify-center px-0',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.75} />
      {!collapsed && sidebarLabel}
    </NavLink>
  )
}

/** iPadOS / macOS-style shell: sidebar (collapsible on tablet) + translucent top toolbar. */
export function DesktopShell() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const [override, setOverride] = useState<boolean | null>(null)
  // Tablet: collapsed by default. Desktop: expanded by default. User toggle wins.
  const collapsed = override ?? !isDesktop
  const isLibrary = pathname === '/' || pathname.startsWith('/shared')

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={() => setOverride(!collapsed)} />
      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-6">
          {isLibrary ? (
            <LibraryToolbar />
          ) : (
            <h1 className="text-base font-semibold">{titleFor(pathname)}</h1>
          )}
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
