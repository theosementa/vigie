import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ItemThumb } from '@/features/items/ItemThumb'
import type { ContactHistoryEntry } from '@/lib/api'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { getLocale, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { contactLabel, useContactHistory, useContacts } from './queries'

const dayKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string, t: TFunction): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000)
  if (days === 0) return t('contacts.day.today')
  if (days === 1) return t('contacts.day.yesterday')
  return formatShortDate(iso, getLocale())
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function Bubble({ entry, name }: { entry: ContactHistoryEntry; name: string }) {
  const t = useT()
  const sent = entry.direction === 'sent'
  const { resource } = entry
  const body = (
    <>
      <span className="sr-only">
        {sent ? t('contacts.thread.sent') : t('contacts.thread.received', { name })}
      </span>
      <span className="bub-item">
        <ItemThumb
          resource={{ ...resource, site_name: null, duration_seconds: null, stars: null }}
        />
        <span className="tt">{resource.title}</span>
      </span>
    </>
  )
  return (
    <li className={cn('bub-row', sent ? 'sent' : 'recv')}>
      <div className="bub">
        {entry.my_item_id ? (
          <Link to={`/?item=${entry.my_item_id}`} className="bub-link">
            {body}
          </Link>
        ) : (
          <div className="bub-link" title={t('contacts.thread.gone')}>
            {body}
          </div>
        )}
        {entry.message && <p className="bub-msg">{entry.message}</p>}
        <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
      </div>
    </li>
  )
}

/** Conversation-style, read-only history with one contact: sent on the right, received on the left. */
export function ContactThread() {
  const t = useT()
  const { id = '' } = useParams()
  const contacts = useContacts()
  const contact = contacts.data?.find((c) => c.id === id)
  const history = useContactHistory(id)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = history

  // Oldest first, like a chat.
  const entries = useMemo(
    () => (history.data?.pages.flatMap((p) => p.entries) ?? []).slice().reverse(),
    [history.data],
  )

  // Keep the reading position: start at the newest entry, stay put when older ones are prepended,
  // follow a new entry only when already at the bottom.
  const seen = useRef<{ height: number; first: string | null; last: string | null } | null>(null)
  useLayoutEffect(() => {
    if (entries.length === 0) return
    const root = document.documentElement
    const first = entries[0].id
    const last = entries[entries.length - 1].id
    const prev = seen.current
    if (!prev) {
      window.scrollTo(0, root.scrollHeight)
    } else if (prev.first !== first && prev.last === last) {
      window.scrollTo(0, window.scrollY + (root.scrollHeight - prev.height))
    } else if (prev.last !== last) {
      const nearBottom = prev.height - window.scrollY - window.innerHeight < 160
      if (nearBottom)
        window.scrollTo({ top: root.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    seen.current = { height: root.scrollHeight, first, last }
  }, [entries])

  // Older entries load when the top of the thread comes into view.
  const top = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = top.current
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([e]) => e.isIntersecting && !isFetchingNextPage && void fetchNextPage(),
      { rootMargin: '240px 0px 0px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, entries.length])

  // Deleted here or on another device: back to the list.
  if (contacts.isSuccess && !contact) return <Navigate to="/contacts" replace />

  const name = contact ? contactLabel(contact) : ''
  return (
    <div className="lib form-page thread-page mx-auto w-full max-w-xl">
      {contact?.name && <p className="sub">{contact.email}</p>}
      {history.isError ? (
        <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
          <p>{t('contacts.thread.error')}</p>
          <button type="button" onClick={() => history.refetch()} className="mt-1 font-medium underline">
            {t('common.retry')}
          </button>
        </div>
      ) : history.isPending ? (
        <div role="status" aria-label={t('common.loading')} className="ct-skeleton" />
      ) : entries.length === 0 ? (
        <div className="empty">
          <p>{t('contacts.thread.empty')}</p>
        </div>
      ) : (
        <>
          <div ref={top} className="thread-top">
            {hasNextPage && (
              <button
                type="button"
                className="link-btn"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? t('common.loading') : t('contacts.thread.older')}
              </button>
            )}
          </div>
          <ul className="thread" aria-label={t('contacts.thread.label', { name })}>
            {entries.map((e, i) => (
              <Fragment key={e.id}>
                {(i === 0 || dayKey(entries[i - 1].at) !== dayKey(e.at)) && (
                  <li className="day-sep">
                    <span>{dayLabel(e.at, t)}</span>
                  </li>
                )}
                <Bubble entry={e} name={name} />
              </Fragment>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
