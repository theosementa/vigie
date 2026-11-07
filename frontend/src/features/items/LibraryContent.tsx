import { useEffect, useRef } from 'react'
import { BookCheck, Inbox, SearchX, TriangleAlert, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ItemGrid } from './ItemGrid'
import type { Library } from './useLibrary'

/** Fires `onVisible` whenever the sentinel is (still) in view; re-armed after every loaded page. */
function InfiniteSentinel({
  onVisible,
  enabled,
  loaded,
}: {
  onVisible: () => void
  enabled: boolean
  loaded: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onVisible)
  useEffect(() => {
    cb.current = onVisible
  })
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    // A fresh observer reports the initial state, so a sentinel that stays visible keeps loading.
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && cb.current(),
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled, loaded])
  return <div ref={ref} aria-hidden className="h-px" />
}

function StateBox({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground [&>svg]:size-10">
      {icon}
      <p className="text-base font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-sm">{hint}</p>}
      {children}
    </div>
  )
}

function EmptyState({ lib }: { lib: Library }) {
  if (lib.hasActiveFilters)
    return (
      <StateBox
        icon={<SearchX />}
        title="Aucun résultat"
        hint="Aucun élément ne correspond à votre recherche ou à vos filtres."
      />
    )
  if (lib.sharedOnly)
    return (
      <StateBox
        icon={<Users />}
        title={lib.filters.status === 'seen' ? 'Rien de vu parmi les partages' : 'Rien de partagé pour l’instant'}
        hint="Les liens que vos amis partagent avec vous apparaîtront ici."
      />
    )
  if (lib.filters.status === 'seen')
    return (
      <StateBox
        icon={<BookCheck />}
        title="Rien de vu pour l’instant"
        hint="Les éléments que vous marquez comme vus se retrouvent ici."
      />
    )
  return (
    <StateBox
      icon={<Inbox />}
      title="Rien à voir pour l’instant"
      hint="Ajoutez un article ou une vidéo avec le bouton « Ajouter »."
    />
  )
}

function SkeletonGrid({ className }: { className?: string }) {
  return (
    <ul className={`grid gap-4 ${className ?? ''}`} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="animate-pulse overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <div className="aspect-video bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-4 w-4/5 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** List body: loading / error / empty states, grid, infinite scroll. */
export function LibraryContent({
  lib,
  className,
  swipeable,
}: {
  lib: Library
  className?: string
  swipeable?: boolean
}) {
  if (lib.isLoading) return <SkeletonGrid className={className} />
  if (lib.isError && lib.items.length === 0)
    return (
      <StateBox
        icon={<TriangleAlert />}
        title="Chargement impossible"
        hint="Vérifiez votre connexion puis réessayez."
      >
        <Button className="mt-2 rounded-xl" onClick={() => lib.refetch()}>
          Réessayer
        </Button>
      </StateBox>
    )
  if (lib.items.length === 0) return <EmptyState lib={lib} />

  return (
    <>
      <ItemGrid
        items={lib.items}
        selectedId={lib.selected?.id}
        onOpen={lib.open}
        className={className}
        swipeable={swipeable}
      />
      <InfiniteSentinel
        enabled={lib.hasNextPage && !lib.isFetchingNextPage}
        loaded={lib.items.length}
        onVisible={lib.fetchNextPage}
      />
      {lib.isFetchingNextPage && (
        <p role="status" className="py-4 text-center text-sm text-muted-foreground">
          Chargement…
        </p>
      )}
    </>
  )
}
