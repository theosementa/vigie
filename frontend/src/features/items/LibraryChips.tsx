import { Fragment, useEffect, useState, type ButtonHTMLAttributes } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { usePile } from '@/features/stats/queries'
import type { ItemStatus, LengthBucket, ResourceType, TagWithCount } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { canonicalQuery } from '@/features/views/query'
import { useViews } from '@/features/views/queries'
import { useViewDialogs } from '@/features/views/viewDialogsContext'
import { cn } from '@/lib/utils'
import { LENGTH_BUCKETS } from './metadata'
import { useResourceTypes } from './useResourceTypes'
import type { LibraryFilters } from './useLibraryFilters'

type Patch = { status?: ItemStatus; type?: ResourceType | 'all'; length?: LengthBucket | null; tag?: string | null }

export function Chip({
  active,
  className,
  ...props
}: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('chip', className)} aria-pressed={active} {...props} />
}

/** Matches the vsave-close animation in motion.css (240 ms) plus a margin. */
const SAVE_LEAVE_MS = 280

/** Keeps the "Save this view" chip mounted for its exit animation once the filters are saved. */
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function useSaveSlot(saveable: boolean) {
  const [slot, setSlot] = useState({ shown: saveable, leaving: false, opening: saveable && !reducedMotion() })
  if (saveable && (!slot.shown || slot.leaving)) setSlot({ shown: true, leaving: false, opening: !slot.shown && !reducedMotion() })
  if (!saveable && slot.shown && !slot.leaving) {
    const reduced = reducedMotion()
    setSlot({ shown: !reduced, leaving: !reduced, opening: false })
  }
  useEffect(() => {
    if (!slot.leaving) return
    const timer = setTimeout(() => setSlot({ shown: false, leaving: false, opening: false }), SAVE_LEAVE_MS)
    return () => clearTimeout(timer)
  }, [slot.leaving])
  // Clipping is only needed while it opens: afterwards the focus ring must show in full.
  const opened = () => setSlot((s) => (s.opening ? { ...s, opening: false } : s))
  return { ...slot, opened }
}

/** Filter chips of the DA: À voir (with the exact count), Vu, type, length, tags. They drive the URL filters. */
export function LibraryChips({
  filters,
  tags,
  onChange,
  withCount,
}: {
  filters: LibraryFilters
  tags: TagWithCount[]
  onChange: (patch: Patch) => void
  /** The count is the whole pile, so only the library (not "shared with me") shows it. */
  withCount: boolean
}) {
  const t = useT()
  const { pile } = usePile()
  const [params] = useSearchParams()
  const { data: views = [] } = useViews()
  const dialogs = useViewDialogs()
  const query = canonicalQuery(params)
  // Offered for a set of filters that is not a saved view yet (the library only, not "shared with me").
  const saveable = withCount && query !== '' && !views.some((v) => canonicalQuery(v.query) === query)
  const save = useSaveSlot(saveable)
  const types = useResourceTypes(filters.type === 'all' ? undefined : filters.type)
  const groups = [
    [
      <Chip key="to_watch" active={filters.status === 'to_watch'} onClick={() => onChange({ status: 'to_watch' })}>
        {t('filters.to_watch')}
        {withCount && pile && <b>{formatNumber(pile.count)}</b>}
      </Chip>,
      <Chip key="seen" active={filters.status === 'seen'} onClick={() => onChange({ status: 'seen' })}>
        {t('filters.seen')}
      </Chip>,
    ],
    types.map((type) => (
      <Chip key={type} active={filters.type === type} onClick={() => onChange({ type: filters.type === type ? 'all' : type })}>
        {t(`filters.${type}`)}
      </Chip>
    )),
    LENGTH_BUCKETS.map((length) => (
      <Chip
        key={length}
        active={filters.length === length}
        onClick={() => onChange({ length: filters.length === length ? null : length })}
      >
        {t(`filters.length.${length}`)}
      </Chip>
    )),
    tags.map((tag) => (
      <Chip key={tag.id} active={filters.tag === tag.name} onClick={() => onChange({ tag: filters.tag === tag.name ? null : tag.name })}>
        #{tag.name}
      </Chip>
    )),
  ].filter((group) => group.length > 0)
  return (
    <div className="chips" role="group" aria-label={t('filters.label')}>
      {groups.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="chips-sep" aria-hidden />}
          {group}
        </Fragment>
      ))}
      {save.shown && (
        // Opens and closes its width and height (gaps included), so nothing jumps, even on a wrapped line.
        <span
          className={cn('vsave', save.leaving ? 'vsave-out' : save.opening && 'vsave-in')}
          inert={save.leaving}
          onAnimationEnd={(e) => e.target === e.currentTarget && save.opened()}
        >
          <span>
            {groups.length > 0 && <span className="chips-sep" aria-hidden />}
            {/* An action, not a toggle: a plain chip without aria-pressed. */}
            <button type="button" className="chip" onClick={() => dialogs.save(query)}>
              <Icon name="bookmark" />
              {t('view.save')}
            </button>
          </span>
        </span>
      )}
    </div>
  )
}
