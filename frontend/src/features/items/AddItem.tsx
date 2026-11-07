import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Sheet } from '@/components/Sheet'
import { TagInput } from '@/features/tags/TagInput'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ApiError, api, type ResourcePreview, type ResourceType } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatDuration, formatMinutesShort } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AddItemContext, useAddItem } from './addItemContext'
import { ItemThumb } from './ItemThumb'
import { siteOf } from './metadata'
import { removeItemNow, useCreateItem } from './queries'
import { looksLikeUrl } from './url'
import { useLibraryFilters } from './useLibraryFilters'

const FORM_ID = 'capture-form'

function PreviewSkeleton() {
  const t = useT()
  return (
    <div className="preview loading" role="status" aria-label={t('capture.preview.loading')}>
      <div className="th skel" />
      <div className="grid gap-2">
        <div className="skel h-4 w-4/5" />
        <div className="skel h-3 w-1/3" />
      </div>
    </div>
  )
}

function Preview({ data, type }: { data: ResourcePreview; type: ResourceType }) {
  const t = useT()
  const detail =
    type === 'video'
      ? data.duration_seconds != null
        ? formatDuration(data.duration_seconds)
        : null
      : data.reading_time_minutes != null
        ? formatMinutesShort(data.reading_time_minutes)
        : null
  const resource = { ...data, type }
  return (
    <div className="preview">
      <ItemThumb resource={resource} />
      <div className="min-w-0">
        <div className="tt">{data.title}</div>
        <div className="meta">
          <span className="min-w-0 truncate">{[siteOf(data), detail, t(`type.${type}`).toLowerCase()].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
    </div>
  )
}

function CaptureForm({
  initialUrl,
  focusRef,
  onClose,
  onBusy,
}: {
  initialUrl: string
  focusRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onBusy: (state: { label: string; disabled: boolean }) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const { update } = useLibraryFilters()
  const create = useCreateItem()
  const [url, setUrl] = useState(initialUrl)
  const [override, setOverride] = useState<ResourceType | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [queue, setQueue] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pasteError, setPasteError] = useState(false)

  const trimmed = url.trim()
  const debounced = useDebouncedValue(trimmed, 450)
  const ready = debounced === trimmed && looksLikeUrl(trimmed)

  const preview = useQuery({
    queryKey: ['preview', debounced],
    queryFn: ({ signal }) => api.resources.preview(debounced, signal),
    enabled: ready,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const data = ready ? preview.data : undefined
  const loading = trimmed !== '' && looksLikeUrl(trimmed) && (!ready || preview.isFetching)
  const previewError = ready && preview.isError ? preview.error : null

  const effectiveType = override ?? data?.type ?? 'article'
  const existingId = data?.existing_item_id ?? null

  const openItem = (id: string) => {
    update({ item: id })
    onClose()
  }

  // The pinned primary action lives in the sheet footer: tell it what to say and when it is usable.
  useEffect(() => {
    onBusy({
      label: create.isPending ? t('capture.adding') : existingId ? t('capture.open_existing') : t('capture.submit'),
      disabled: !data || loading || create.isPending,
    })
  }, [onBusy, t, create.isPending, existingId, data, loading])

  const paste = async () => {
    setPasteError(false)
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) {
        setUrl(text)
        setOverride(null)
        setSaveError(null)
      }
      focusRef.current?.focus()
    } catch {
      // permission denied or unsupported: say so, the field stays usable
      setPasteError(true)
    }
  }

  const save = () => {
    if (!data) return
    setSaveError(null)
    const queued = effectiveType === 'video' && queue
    create.mutate(
      {
        url: data.url,
        type: override && override !== data.type ? override : undefined,
        tags,
        notes: notes.trim() || null,
        queue: queued ? true : undefined,
      },
      {
        onSuccess: (item) => {
          toast(t(queued ? 'capture.added_queue' : 'capture.added'), {
            action: {
              label: t('common.undo'),
              onClick: () =>
                removeItemNow(qc, item.id).catch((err) => toast.error(errorMessage(err, t('error.undo_failed')))),
            },
          })
          onClose()
        },
        onError: (err) => {
          const conflictId = err instanceof ApiError ? err.conflict?.item_id : null
          if (conflictId) {
            toast(t('capture.duplicate'))
            openItem(conflictId)
          } else {
            setSaveError(errorMessage(err, t('capture.failed')))
          }
        },
      },
    )
  }

  return (
    <form
      id={FORM_ID}
      className="grid gap-3.5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!data) return
        if (existingId) openItem(existingId)
        else save()
      }}
    >
      <div className="field">
        <label htmlFor="capture-url">{t('capture.link')}</label>
        <input
          id="capture-url"
          ref={focusRef}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setOverride(null)
            setSaveError(null)
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-2 btn-sm" onClick={() => void paste()}>
          <Icon name="clipboard" />
          {t('capture.paste')}
        </button>
        {pasteError && (
          <span className="sub" role="status">
            {t('capture.paste_failed')}
          </span>
        )}
      </div>

      {loading && <PreviewSkeleton />}

      {previewError && !loading && (
        <div role="alert" className="alert err">
          <Icon name="danger-triangle" />
          <div className="flex-1">
            <p className="m-0">
              {previewError instanceof ApiError && previewError.status === 422
                ? t('capture.invalid_url')
                : errorMessage(previewError, t('capture.preview_failed'))}
            </p>
            <button type="button" className="link-btn mt-1" onClick={() => preview.refetch()}>
              {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          <Preview data={data} type={effectiveType} />
          {existingId ? (
            <div className="alert" role="status">
              <Icon name="check-circle" />
              <span className="flex-1 font-medium">{t('capture.duplicate')}</span>
            </div>
          ) : (
            <>
              <div className="seg full" role="group" aria-label={t('item.type')}>
                {(['article', 'video'] as const).map((type) => (
                  <button key={type} type="button" aria-pressed={effectiveType === type} onClick={() => setOverride(type)}>
                    <Icon name={type === 'video' ? 'videocamera' : 'document-text'} className="xs" />
                    {t(`type.${type}`)}
                  </button>
                ))}
              </div>
              {effectiveType === 'video' && (
                <label className="check">
                  <input type="checkbox" checked={queue} onChange={(e) => setQueue(e.target.checked)} />
                  {t('item.queue.add')}
                </label>
              )}
              <div className="grid gap-1.5">
                <label htmlFor="capture-tags" className="h-label">
                  {t('item.tags')}
                </label>
                <TagInput id="capture-tags" value={tags} onChange={setTags} />
              </div>
              <div className="field">
                <label htmlFor="capture-note">{t('capture.note')}</label>
                <textarea
                  id="capture-note"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('capture.note.placeholder')}
                />
              </div>
            </>
          )}
          {saveError && (
            <p role="alert" className="alert err m-0">
              {saveError}
            </p>
          )}
        </>
      )}
    </form>
  )
}

/**
 * Capture host: full-screen sheet on a phone, centred modal from 768 px. Mounted once by the shell;
 * the tab bar's central action, the rail, the header and the N shortcut open it via `useAddItem()`.
 */
export function AddItemProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [initialUrl, setInitialUrl] = useState('')
  const [action, setAction] = useState({ label: '', disabled: true })
  const focusRef = useRef<HTMLInputElement | null>(null)
  const api = useMemo(
    () => ({
      open: (url?: string) => {
        setInitialUrl(url ?? '')
        setOpen(true)
      },
    }),
    [],
  )

  // N opens the capture when the focus is not in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      setInitialUrl('')
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <AddItemContext.Provider value={api}>
      {children}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('capture.title')}
        initialFocus={focusRef}
        footer={
          <button type="submit" form={FORM_ID} className={cn('cta')} disabled={action.disabled}>
            <Icon name="add" small />
            {action.label || t('capture.submit')}
          </button>
        }
      >
        {open && (
          <CaptureForm
            initialUrl={initialUrl}
            focusRef={focusRef}
            onClose={() => setOpen(false)}
            onBusy={setAction}
          />
        )}
      </Sheet>
    </AddItemContext.Provider>
  )
}

/** Desktop trigger for the capture (page header). */
export function AddItemButton() {
  const t = useT()
  const { open } = useAddItem()
  return (
    <button type="button" className="btn btn-accent" onClick={() => open()}>
      <Icon name="add" />
      {t('nav.add')}
    </button>
  )
}
