import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, api, type ResourceType } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatReadingTime, hostname } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useIsMobile } from '@/hooks/useIsMobile'
import { TagInput } from '@/features/tags/TagInput'
import { ItemThumbnail } from './ItemThumbnail'
import { AddItemContext, useAddItem } from './addItemContext'
import { useCreateItem } from './queries'
import { useLibraryFilters } from './useLibraryFilters'

const COPY = {
  title: 'Ajouter un lien',
  description: 'Collez une URL : l’aperçu apparaît automatiquement.',
}

const looksLikeUrl = (v: string) => /^https?:\/\//i.test(v) || /^[^\s/]+\.[^\s/]{2,}/.test(v)

function PreviewSkeleton() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-2xl bg-card ring-1 ring-border"
      aria-label="Chargement de l’aperçu"
      role="status"
    >
      <div className="aspect-video bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
      </div>
    </div>
  )
}

function AddItemForm({ onClose }: { onClose: () => void }) {
  const { update } = useLibraryFilters()
  const create = useCreateItem()
  const [url, setUrl] = useState('')
  const [override, setOverride] = useState<ResourceType | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [queue, setQueue] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Pre-fill from the clipboard when it holds an http(s) URL. Any failure is ignored.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim()
        if (!cancelled && /^https?:\/\/\S+$/i.test(text)) setUrl((cur) => cur || text)
      } catch {
        /* permission denied / unsupported: silently ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const trimmed = url.trim()
  const debounced = useDebouncedValue(trimmed, 500)
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

  const save = () => {
    if (!data) return
    setSaveError(null)
    create.mutate(
      {
        url: data.url,
        type: override && override !== data.type ? override : undefined,
        tags,
        notes: notes.trim() || null,
        queue: effectiveType === 'video' && queue ? true : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            effectiveType === 'video' && queue
              ? 'Ajouté à la bibliothèque et à la file d’attente'
              : 'Ajouté à votre bibliothèque',
          )
          onClose()
        },
        onError: (err) => {
          const conflictId = err instanceof ApiError ? err.conflict?.item_id : null
          if (conflictId) {
            toast('Déjà dans ta bibliothèque')
            openItem(conflictId)
          } else {
            setSaveError(errorMessage(err, 'Ajout impossible. Réessaie.'))
          }
        },
      },
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (data && !existingId) save()
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="add-url">Lien</Label>
        <Input
          id="add-url"
          type="url"
          inputMode="url"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setOverride(null)
            setSaveError(null)
          }}
          className="h-11 rounded-xl text-base md:text-sm"
        />
      </div>

      {loading && <PreviewSkeleton />}

      {previewError && !loading && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <Icon name="danger-triangle" className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p>
              {previewError instanceof ApiError && previewError.status === 422
                ? 'Cette adresse n’est pas valide.'
                : errorMessage(previewError, 'Impossible de récupérer l’aperçu.')}
            </p>
            <button type="button" onClick={() => preview.refetch()} className="mt-1 font-medium underline">
              Réessayer
            </button>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <ItemThumbnail resource={{ ...data, type: effectiveType }} />
            <div className="space-y-1.5 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {data.favicon_url && (
                  <img src={data.favicon_url} alt="" className="size-4 rounded-sm" />
                )}
                <span className="truncate">{data.site_name ?? hostname(data.url)}</span>
                {effectiveType === 'article' && data.reading_time_minutes != null && (
                  <span className="shrink-0">· {formatReadingTime(data.reading_time_minutes)}</span>
                )}
              </div>
              <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{data.title}</h3>
            </div>
          </article>

          {existingId ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 p-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-accent-ink">
                <Icon name="check-circle" className="size-4" />
                Déjà dans ta bibliothèque
              </span>
              <Button type="button" size="sm" className="rounded-lg" onClick={() => openItem(existingId)}>
                Ouvrir
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Type</span>
                <Tabs value={effectiveType} onValueChange={(v) => setOverride(v as ResourceType)}>
                  <TabsList className="h-9 w-full rounded-xl">
                    <TabsTrigger value="article" className="flex-1 rounded-lg">
                      Article
                    </TabsTrigger>
                    <TabsTrigger value="video" className="flex-1 rounded-lg">
                      Vidéo
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {effectiveType === 'video' && (
                <label
                  htmlFor="add-queue"
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm"
                >
                  <input
                    id="add-queue"
                    type="checkbox"
                    checked={queue}
                    onChange={(e) => setQueue(e.target.checked)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="font-medium">Ajouter à la file d’attente</span>
                </label>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="add-tags">Tags</Label>
                <TagInput id="add-tags" value={tags} onChange={setTags} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-notes">Notes (facultatif)</Label>
                <Textarea
                  id="add-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-16 rounded-xl"
                  placeholder="Pourquoi ce lien ?"
                />
              </div>
              {saveError && (
                <p role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
              <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={create.isPending}>
                {create.isPending ? 'Ajout…' : 'Ajouter'}
              </Button>
            </>
          )}
        </>
      )}
    </form>
  )
}

/**
 * Add flow host: bottom Sheet on mobile, centered Dialog on desktop (⌘N / ⌘K). Mounted once by the
 * shell; the tab bar's central action, the rail, and the library toolbar open it via `useAddItem()`.
 */
export function AddItemProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const api = useMemo(() => ({ open: () => setOpen(true) }), [])

  useEffect(() => {
    if (isMobile) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 'k')) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile])

  const close = () => setOpen(false)

  return (
    <AddItemContext.Provider value={api}>
      {children}
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[calc(100dvh-var(--safe-top)-1rem)] rounded-t-3xl pb-safe"
          >
            <SheetHeader>
              <SheetTitle>{COPY.title}</SheetTitle>
              <SheetDescription>{COPY.description}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {open && <AddItemForm onClose={close} />}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{COPY.title}</DialogTitle>
              <DialogDescription>{COPY.description}</DialogDescription>
            </DialogHeader>
            {open && <AddItemForm onClose={close} />}
          </DialogContent>
        </Dialog>
      )}
    </AddItemContext.Provider>
  )
}

/** Desktop trigger for the add flow (library toolbar). */
export function AddItemButton() {
  const { open } = useAddItem()
  return (
    <Button onClick={open} className="h-9 rounded-xl px-3">
      <Icon name="add" />
      Ajouter
    </Button>
  )
}
