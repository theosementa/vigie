import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconBase } from '@/components/Icon'
import type { Item, ItemEvent, ResourceType } from '@/lib/api'
import { formatDateTime, formatDuration, formatMinutesShort, formatDate, fullName } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { TagInput } from '@/features/tags/TagInput'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { ItemThumb } from './ItemThumb'
import { useItemDialogs } from './itemDialogsContext'
import { isMetadataUnavailable, siteOf } from './metadata'
import { useItemEvents, useSetItemStatus, useUpdateItem } from './queries'
import { useRefreshWithToast } from './useRefreshItem'

const AUTOSAVE_MS = 800

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Note, autosaved on blur and 800 ms after the last keystroke. */
function NotesEditor({ item }: { item: Item }) {
  const t = useT()
  const update = useUpdateItem()
  const [value, setValue] = useState(item.notes ?? '')
  const [state, setState] = useState<SaveState>('idle')
  const lastSaved = useRef(item.notes ?? '')
  const latest = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { mutate } = update
  const id = item.id

  const save = useCallback(
    (v: string) => {
      if (v === lastSaved.current) return
      const previous = lastSaved.current
      lastSaved.current = v
      setState('saving')
      mutate(
        { id, input: { notes: v } },
        {
          onSuccess: () => setState('saved'),
          onError: () => {
            lastSaved.current = previous
            setState('error')
          },
        },
      )
    },
    [id, mutate],
  )

  // Flush a pending edit when the detail closes / switches item.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        if (latest.current !== lastSaved.current) mutate({ id, input: { notes: latest.current } })
      }
    },
    [id, mutate],
  )

  const onChange = (v: string) => {
    setValue(v)
    latest.current = v
    setState('idle')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = undefined
      save(v)
    }, AUTOSAVE_MS)
  }

  const onBlur = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    save(latest.current)
  }

  return (
    <div className="field">
      <label htmlFor="item-notes">{t('item.note')}</label>
      <textarea
        id="item-notes"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={t('item.note.placeholder')}
      />
      <div className={cn('help', state === 'error' && 'err')} aria-live="polite">
        {state === 'saving' && t('item.note.saving')}
        {state === 'saved' && t('item.note.saved')}
        {state === 'error' && t('item.note.error')}
      </div>
    </div>
  )
}

function TagsEditor({ item }: { item: Item }) {
  const t = useT()
  const update = useUpdateItem()
  const [tags, setTags] = useState(() => item.tags.map((tag) => tag.name))
  return (
    <div className="grid gap-1.5">
      <label htmlFor="item-tags" className="h-label">
        {t('item.tags')}
      </label>
      <TagInput
        id="item-tags"
        value={tags}
        onChange={(next) => {
          setTags(next)
          update.mutate({ id: item.id, input: { tags: next } })
        }}
      />
    </div>
  )
}

/** Duration or reading time with how much it can be trusted (VISION principle 3). */
function Facts({ item }: { item: Item }) {
  const t = useT()
  const { resource } = item
  const video = resource.type === 'video'
  const value = video ? resource.duration_seconds : resource.reading_time_minutes
  return (
    <div className="facts">
      <span className="f">
        <Icon name={video ? 'videocamera' : 'document-text'} className="xs" />
        {t(video ? 'type.video' : 'type.article')}
      </span>
      <span className="f">
        {value != null
          ? video
            ? formatDuration(resource.duration_seconds!)
            : formatMinutesShort(resource.reading_time_minutes!)
          : t(video ? 'item.duration_unknown' : 'item.reading_unknown')}
        <span className="conf">{t(value == null ? 'conf.unknown' : video ? 'conf.measured' : 'conf.estimated')}</span>
      </span>
      {resource.published_at && <span className="f">{formatDate(resource.published_at)}</span>}
    </div>
  )
}

const EVENT_ICON: Record<ItemEvent['kind'], IconBase> = {
  added: 'add',
  seen: 'check-circle',
  unseen: 'restart',
  deleted: 'trash-bin-minimalistic',
  shared: 'plain',
}

function History({ id }: { id: string }) {
  const t = useT()
  const { data: events, isError } = useItemEvents(id)
  if (isError || !events || events.length === 0) return null
  // Newest first.
  const rows = [...events].reverse()
  const label = (e: ItemEvent) => {
    const who = e.other_user ? fullName(e.other_user) : ''
    switch (e.kind) {
      case 'added':
        return who ? t('history.received', { name: who }) : t('history.added')
      case 'seen':
        return t('history.seen')
      case 'unseen':
        return t('history.unseen')
      case 'shared':
        return t('history.shared', { name: who })
      case 'deleted':
        return t('history.deleted')
    }
  }
  return (
    <section className="grid gap-2" aria-labelledby="history-h">
      <h4 id="history-h" className="h-label">
        {t('item.history')}
      </h4>
      <ul className="history">
        {rows.map((e, i) => (
          <li key={`${e.kind}-${e.occurred_at}-${i}`}>
            <Icon name={EVENT_ICON[e.kind]} />
            <span>{label(e)}</span>
            <time dateTime={e.occurred_at}>{formatDateTime(e.occurred_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Detail body shared by the phone sheet, the tablet modal and the desktop inspector. */
export function ItemDetail({ item, onClose }: { item: Item; onClose?: () => void }) {
  const t = useT()
  const { resource } = item
  const setStatus = useSetItemStatus()
  const update = useUpdateItem()
  const refresh = useRefreshWithToast()
  const dialogs = useItemDialogs()
  const queue = useQueueToggle(item)
  const seen = item.status === 'seen'
  const unavailable = isMetadataUnavailable(resource)

  return (
    <>
      <div className={cn(unavailable && 'is-unknown')}>
        <ItemThumb resource={resource} className="detail-th" />
      </div>
      <div className="grid gap-2">
        <h2 className="detail-t">{resource.title || siteOf(resource)}</h2>
        <div className="site">
          {resource.favicon_url && (
            <img src={resource.favicon_url} alt="" referrerPolicy="no-referrer" loading="lazy" />
          )}
          <span>
            {siteOf(resource)}
            {resource.author && ` · ${resource.author}`}
          </span>
        </div>
        {unavailable ? (
          <div className="alert" role="status">
            <Icon name="info-circle" />
            <span className="flex-1">{t('item.unavailable.long')}</span>
            <button type="button" className="link-btn" disabled={refresh.pending} onClick={() => refresh.refresh(item.id)}>
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <Facts item={item} />
        )}
        {resource.description && <p className="sub line-clamp-4">{resource.description}</p>}
      </div>

      {item.shared_by && (
        <div className="recv">
          <span className="dot" aria-hidden="true" />
          <span>
            {t('item.shared_by', { name: fullName(item.shared_by) })}
            {item.share_message && (
              <>
                {' '}
                <q>{item.share_message}</q>
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid gap-1.5">
        <span className="h-label" id="status-label">
          {t('item.status')}
        </span>
        <div className="seg full" role="group" aria-labelledby="status-label">
          {(['to_watch', 'seen'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={item.status === s}
              onClick={() => item.status !== s && setStatus.mutate({ id: item.id, status: s })}
            >
              {t(`item.status.${s}`)}
            </button>
          ))}
        </div>
        {seen && item.seen_at && <div className="sub">{t('item.seen_on', { date: formatDate(item.seen_at) })}</div>}
      </div>

      <div className="grid gap-1.5">
        <span className="h-label" id="type-label">
          {t('item.type')}
        </span>
        <div className="seg full" role="group" aria-labelledby="type-label">
          {(['article', 'video'] as ResourceType[]).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={resource.type === type}
              onClick={() => resource.type !== type && update.mutate({ id: item.id, input: { type } })}
            >
              <Icon name={type === 'video' ? 'videocamera' : 'document-text'} className="xs" />
              {t(`type.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* keyed: editors keep local draft state per item */}
      <TagsEditor key={`tags-${item.id}`} item={item} />
      <NotesEditor key={`notes-${item.id}`} item={item} />

      <div className="actions">
        <a className="btn btn-accent" href={resource.url} target="_blank" rel="noopener noreferrer">
          <Icon name="arrow-right-up" />
          {t('item.open_link')}
        </a>
        <button type="button" className="btn btn-2" onClick={() => dialogs.share(item)}>
          <Icon name="share" />
          {t('item.share')}
        </button>
        {queue.available && (
          <button type="button" className="btn btn-2" aria-pressed={queue.queued} disabled={queue.pending} onClick={queue.toggle}>
            <Icon name={queue.queued ? 'list-minus-minimalistic' : 'list-plus-minimalistic'} />
            {t(queue.queued ? 'item.queue.remove' : 'item.queue.add')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-2"
          disabled={refresh.pending}
          onClick={() => refresh.refresh(item.id)}
        >
          <Icon name="refresh" className={refresh.pending ? 'animate-spin' : undefined} />
          {t('item.refresh')}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => dialogs.confirmDelete(item, onClose)}>
          <Icon name="trash-bin-minimalistic" />
          {t('common.delete')}
        </button>
      </div>

      <History id={item.id} />
    </>
  )
}
