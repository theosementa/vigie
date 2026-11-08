import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useAddItem } from './addItemContext'
import { ItemList } from './ItemList'
import { useTags } from './queries'
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

/** The DA empty state: ghost figure, one sentence, the primary action. */
function EmptyState({ lib }: { lib: Library }) {
  const t = useT()
  const { open } = useAddItem()
  const { data: tags } = useTags()
  const tag = lib.filters.tag?.trim().toLowerCase()
  // A saved view can outlive its tag.
  const tagGone = Boolean(tag) && tags !== undefined && !tags.some((x) => x.name.toLowerCase() === tag)
  const seen = lib.filters.status === 'seen'
  const first = !lib.hasActiveFilters && !lib.sharedOnly && !seen
  const kind = tagGone ? 'tag_gone' : lib.hasActiveFilters ? 'filtered' : lib.sharedOnly ? (seen ? 'shared_seen' : 'shared') : seen ? 'seen' : 'to_watch'
  return (
    <div className="empty">
      <div className="ghost">{t(seen ? 'empty.ghost.seen' : 'empty.ghost.to_watch')}</div>
      <p>{t(`empty.${kind}`)}</p>
      {first && (
        <div className="btns">
          <button type="button" className="btn btn-accent btn-sm" onClick={() => open()}>
            <Icon name="add" />
            {t('nav.add')}
          </button>
        </div>
      )}
    </div>
  )
}

function Skeletons({ variant }: { variant: 'list' | 'cards' }) {
  const t = useT()
  return variant === 'list' ? (
    <div className="list" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="it">
          <div className="th skel" />
          <div className="grid gap-2">
            <div className="skel h-4 w-4/5" />
            <div className="skel h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="cards" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card">
          <div className="th skel" style={{ borderRadius: 0 }} />
          <div className="cb grid gap-2">
            <div className="skel h-4 w-4/5" />
            <div className="skel h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** List body: loading / error / empty states, items, infinite scroll. */
export function LibraryContent({ lib, variant }: { lib: Library; variant: 'list' | 'cards' }) {
  const t = useT()
  // Skeletons only for a genuinely slow load: a fast empty answer must not flash one.
  const showSkeleton = useDelayedFlag(lib.isLoading)
  if (lib.isLoading) return showSkeleton ? <Skeletons variant={variant} /> : null
  if (lib.isError && lib.items.length === 0)
    return (
      <div className="empty" role="alert">
        <div className="ghost">—</div>
        <p>{t('library.error')}</p>
        <div className="btns">
          <button type="button" className="btn btn-2 btn-sm" onClick={() => lib.refetch()}>
            <Icon name="restart" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  // A length filter says what it leaves out, so the list never looks complete when it is not.
  // It mounts with the list (a new filter is a new query), so it rises in with the rows.
  const unknown = lib.lengthUnknown ? (
    <p className="sub enter mb-3">
      {t('library.length_unknown', { count: lib.lengthUnknown, formatted: formatNumber(lib.lengthUnknown) })}
    </p>
  ) : null
  if (lib.items.length === 0)
    return (
      <>
        {unknown}
        <EmptyState lib={lib} />
      </>
    )

  return (
    <>
      {unknown}
      <ItemList items={lib.items} selectedId={lib.selected?.id} onOpen={lib.open} variant={variant} />
      <InfiniteSentinel
        enabled={lib.hasNextPage && !lib.isFetchingNextPage}
        loaded={lib.items.length}
        onVisible={lib.fetchNextPage}
      />
      {lib.isFetchingNextPage && (
        <p role="status" className="sub py-3 text-center">
          {t('common.loading')}
        </p>
      )}
    </>
  )
}
