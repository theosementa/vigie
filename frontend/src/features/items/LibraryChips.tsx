import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
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
import { LENGTH_BUCKETS, TYPE_ICON } from './metadata'
import { useResourceTypes } from './useResourceTypes'
import type { LibraryFilters } from './useLibraryFilters'

type Patch = { status?: ItemStatus; type?: ResourceType[]; length?: LengthBucket | null; tag?: string[] }

/** Adds `value` to the list, or removes it when it is already there. */
const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

/** "Vidéos", or "Vidéos +2" when several values are picked. */
const summary = (labels: string[]) => (labels.length === 0 ? null : labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`)

export function Chip({
  active,
  className,
  ...props
}: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('chip', className)} aria-pressed={active} {...props} />
}

/** Matches the vsave-close animation in motion.css (240 ms) plus a margin. */
const LEAVE_MS = 280

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Keeps a chip mounted for its exit animation (vsave-in / vsave-out in motion.css). */
function usePresence(visible: boolean) {
  const [slot, setSlot] = useState({ shown: visible, leaving: false, opening: false })
  if (visible && (!slot.shown || slot.leaving)) setSlot({ shown: true, leaving: false, opening: !slot.shown && !reducedMotion() })
  if (!visible && slot.shown && !slot.leaving) {
    const reduced = reducedMotion()
    setSlot({ shown: !reduced, leaving: !reduced, opening: false })
  }
  useEffect(() => {
    if (!slot.leaving) return
    const timer = setTimeout(() => setSlot({ shown: false, leaving: false, opening: false }), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [slot.leaving])
  // Clipping is only needed while it opens: afterwards the focus ring must show in full.
  const opened = () => setSlot((s) => (s.opening ? { ...s, opening: false } : s))
  return { ...slot, opened }
}

/** A chip that opens and closes its width (and the gap before it), so its neighbours slide instead of jumping. */
function Presence({ visible, children }: { visible: boolean; children: ReactNode }) {
  const p = usePresence(visible)
  if (!p.shown) return null
  return (
    <span
      className={cn('vsave', p.leaving ? 'vsave-out' : p.opening && 'vsave-in')}
      inert={p.leaving}
      onAnimationEnd={(e) => e.target === e.currentTarget && p.opened()}
    >
      <span>{children}</span>
    </span>
  )
}

/**
 * Tweens an element's width from its previous size whenever `key` changes, so a pill whose label
 * changes ("Type" → "Vidéos ×") grows smoothly and the pills after it slide.
 */
function useWidthTween(key: string) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const running = el.getAnimations().filter((a) => a.id === 'pill-w')
    const from = running.length ? el.getBoundingClientRect().width : last.current
    running.forEach((a) => a.cancel())
    const to = el.getBoundingClientRect().width
    last.current = to
    if (from === null || Math.abs(from - to) < 1 || reducedMotion()) return
    el.animate({ width: [`${from}px`, `${to}px`] }, { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)', id: 'pill-w' })
  }, [key])
  return ref
}

/**
 * One filter family as a single pill: "Type ⌄" when it does not filter, filled with its value and a
 * clear button ("Vidéos +1 ×") when it does. The pill opens a popover with the family's choices;
 * types and tags take several values, so their popover stays open while you pick.
 */
function FilterPill({
  label,
  value,
  icon,
  clearLabel,
  onClear,
  popupClassName,
  children,
}: {
  label: string
  /** The active value's label, or null when the family does not filter. */
  value: string | null
  icon?: ReactNode
  clearLabel: string
  onClear: () => void
  popupClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useWidthTween(value ?? '')
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <span ref={ref} className="pill" data-active={value !== null || undefined}>
        <Popover.Trigger className="pill-open" aria-label={value !== null ? `${label} : ${value}` : undefined}>
          {value !== null ? (
            <>
              {icon}
              <span className="pill-v">{value}</span>
            </>
          ) : (
            <>
              {label}
              <Icon name="alt-arrow-down" className="pill-car" />
            </>
          )}
        </Popover.Trigger>
        {value !== null && (
          <button type="button" className="pill-x" aria-label={clearLabel} title={clearLabel} onClick={onClear}>
            <Icon name="close" />
          </button>
        )}
      </span>
      <Popover.Portal>
        <Popover.Positioner className="z-[60] outline-none" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
          <Popover.Popup className={cn('fpop', popupClassName)}>{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="fopt" aria-pressed={active} onClick={onClick}>
      {children}
      {active ? <Icon name="check" className="fopt-ck" /> : <span className="fopt-ck" />}
    </button>
  )
}

/** Searchable tag list, most used first. Enter toggles the first match. */
function TagList({
  tags,
  active,
  onToggle,
}: {
  tags: TagWithCount[]
  active: string[]
  onToggle: (name: string) => void
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.item_count - a.item_count || a.name.localeCompare(b.name)),
    [tags],
  )
  const needle = q.trim().replace(/^#/, '').toLocaleLowerCase()
  const isActive = (name: string) => active.some((x) => x.toLowerCase() === name.toLowerCase())
  const shown = needle ? sorted.filter((tag) => tag.name.toLocaleLowerCase().includes(needle)) : sorted
  return (
    <>
      <label className="in fpop-search">
        <Icon name="magnifier" className="xs" />
        <input
          type="search"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) {
              e.preventDefault()
              onToggle(shown[0].name)
              setQ('')
            }
          }}
          placeholder={t('filters.tags.search')}
          aria-label={t('filters.tags.search')}
        />
      </label>
      <div className="fpop-list">
        {shown.map((tag) => (
          <Option key={tag.id} active={isActive(tag.name)} onClick={() => onToggle(tag.name)}>
            <span className="fopt-l">#{tag.name}</span>
            <span className="fopt-n">{formatNumber(tag.item_count)}</span>
          </Option>
        ))}
        {shown.length === 0 && <p className="fpop-empty">{t('filters.tags.none')}</p>}
      </div>
    </>
  )
}

/**
 * Library filters: one pill per family (status, type, length, tags) that shows its value when it filters. They drive the URL filters.
 */
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
  const types = useResourceTypes(filters.type)
  const activeCount = filters.type.length + (filters.length !== null ? 1 : 0) + filters.tag.length
  // Toggled by name, case-insensitively (a view's URL may spell a tag differently).
  const toggleTag = (name: string) => {
    const has = filters.tag.some((x) => x.toLowerCase() === name.toLowerCase())
    onChange({ tag: has ? filters.tag.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...filters.tag, name] })
  }

  return (
    <div className="fbar" role="group" aria-label={t('filters.label')}>
      <div className="chips">
        <FilterPill
          label={t('filters.status')}
          value={filters.status === 'seen' ? t('filters.seen') : null}
          clearLabel={t('filters.clear_one', { name: t('filters.status') })}
          onClear={() => onChange({ status: 'to_watch' })}
        >
          <Option active={filters.status === 'to_watch'} onClick={() => onChange({ status: 'to_watch' })}>
            <span className="fopt-l">{t('filters.to_watch')}</span>
            {withCount && pile && <span className="fopt-n">{formatNumber(pile.count)}</span>}
          </Option>
          <Option active={filters.status === 'seen'} onClick={() => onChange({ status: 'seen' })}>
            <span className="fopt-l">{t('filters.seen')}</span>
          </Option>
        </FilterPill>
        <FilterPill
          label={t('filters.type')}
          value={summary(filters.type.map((type) => t(`filters.${type}`)))}
          icon={filters.type.length === 1 ? <Icon name={TYPE_ICON[filters.type[0]]} /> : undefined}
          clearLabel={t('filters.clear_one', { name: t('filters.type') })}
          onClear={() => onChange({ type: [] })}
        >
          {types.map((type) => (
            <Option key={type} active={filters.type.includes(type)} onClick={() => onChange({ type: toggle(filters.type, type) })}>
              <Icon name={TYPE_ICON[type]} />
              <span className="fopt-l">{t(`filters.${type}`)}</span>
            </Option>
          ))}
        </FilterPill>
        <FilterPill
          label={t('filters.length')}
          value={filters.length === null ? null : t(`filters.length.${filters.length}`)}
          clearLabel={t('filters.clear_one', { name: t('filters.length') })}
          onClear={() => onChange({ length: null })}
        >
          {LENGTH_BUCKETS.map((length) => (
            <Option
              key={length}
              active={filters.length === length}
              onClick={() => onChange({ length: filters.length === length ? null : length })}
            >
              <span className="fopt-l">{t(`filters.length.${length}`)}</span>
            </Option>
          ))}
        </FilterPill>
        {(tags.length > 0 || filters.tag.length > 0) && (
          <FilterPill
            label={t('filters.tags')}
            value={summary(filters.tag.map((tag) => `#${tag}`))}
            clearLabel={t('filters.clear_one', { name: t('filters.tags') })}
            onClear={() => onChange({ tag: [] })}
            popupClassName="fpop-tags"
          >
            <TagList tags={tags} active={filters.tag} onToggle={toggleTag} />
          </FilterPill>
        )}
        <Presence visible={activeCount >= 2}>
          <button type="button" className="chip fclear" onClick={() => onChange({ type: [], length: null, tag: [] })}>
            {t('filters.clear')}
          </button>
        </Presence>
        <Presence visible={saveable}>
          {/* An action, not a toggle: a plain chip without aria-pressed. */}
          <button type="button" className="chip" onClick={() => dialogs.save(query)}>
            <Icon name="bookmark" />
            {t('view.save')}
          </button>
        </Presence>
      </div>
    </div>
  )
}
