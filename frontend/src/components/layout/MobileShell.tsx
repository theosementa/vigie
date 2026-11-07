import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV, titleFor } from './nav'

const COLLAPSE_AT = 36

/** iOS-style shell: translucent nav bar with collapsing large title + bottom tab bar. */
export function MobileShell() {
  const { pathname } = useLocation()
  const title = titleFor(pathname)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <header
        className={cn(
          'pt-safe fixed inset-x-0 top-0 z-30 border-b transition-colors',
          collapsed ? 'glass border-border' : 'border-transparent',
        )}
      >
        <div className="flex h-11 items-center justify-center">
          <span
            className={cn(
              'text-[17px] font-semibold transition-opacity duration-200',
              collapsed ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={!collapsed}
          >
            {title}
          </span>
        </div>
      </header>

      <main className="px-4 pt-[calc(var(--safe-top)+2.75rem)] pb-[calc(5.5rem+var(--safe-bottom))]">
        <h1 className="pt-1 pb-3 text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        className="glass pb-safe fixed inset-x-0 bottom-0 z-30 border-t"
      >
        <ul className="mx-auto grid h-[3.25rem] max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="size-6" strokeWidth={1.75} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
