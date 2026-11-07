import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, ListEnd, ListMinus, RefreshCw, Share2, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Item, ResourceType } from '@/lib/api'
import { formatDate, formatReadingTime, fullName, hostname } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TagInput } from '@/features/tags/TagInput'
import { useQueueToggle } from '@/features/queue/useQueueToggle'
import { ItemThumbnail } from './ItemThumbnail'
import { useItemDialogs } from './itemDialogsContext'
import { useRefreshItem, useSetItemStatus, useUpdateItem } from './queries'

const AUTOSAVE_MS = 800

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Notes textarea, autosaved on blur and 800 ms after the last keystroke. */
function NotesEditor({ item }: { item: Item }) {
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
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label
          htmlFor="item-notes"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Notes
        </label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {state === 'saving' && 'Enregistrement…'}
          {state === 'saved' && 'Enregistré'}
          {state === 'error' && <span className="text-destructive">Non enregistré</span>}
        </span>
      </div>
      <Textarea
        id="item-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Ajouter une note…"
        className="min-h-24 rounded-xl bg-muted/60"
      />
    </div>
  )
}

function TagsEditor({ item }: { item: Item }) {
  const update = useUpdateItem()
  const [tags, setTags] = useState(() => item.tags.map((t) => t.name))
  return (
    <div>
      <label
        htmlFor="item-tags"
        className="mb-1 block text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Tags
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

/** Detail body shared by the mobile bottom sheet, the tablet side sheet and the desktop inspector. */
export function ItemDetail({ item, onClose }: { item: Item; onClose?: () => void }) {
  const { resource } = item
  const setStatus = useSetItemStatus()
  const update = useUpdateItem()
  const refresh = useRefreshItem()
  const dialogs = useItemDialogs()
  const queue = useQueueToggle(item)
  const seen = item.status === 'seen'

  return (
    <div className="space-y-4">
      <ItemThumbnail resource={resource} className="rounded-2xl" />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {resource.site_name ?? hostname(resource.url)}
          {resource.author && ` · ${resource.author}`}
          {resource.type === 'article' &&
            resource.reading_time_minutes != null &&
            ` · ${formatReadingTime(resource.reading_time_minutes)}`}
        </p>
        <h2 className="text-lg leading-snug font-semibold">{resource.title}</h2>
        {resource.description && (
          <p className="line-clamp-4 text-sm text-muted-foreground">{resource.description}</p>
        )}
        {seen && item.seen_at && (
          <p className="text-xs text-muted-foreground">Vu le {formatDate(item.seen_at)}</p>
        )}
      </div>

      {item.shared_by && (
        <div className="rounded-xl bg-primary/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-primary">
            <Users className="size-4" />
            Partagé par {fullName(item.shared_by)}
          </p>
          {item.share_message && <p className="mt-1 text-foreground/80">« {item.share_message} »</p>}
        </div>
      )}

      <Button
        className="h-10 w-full rounded-xl"
        variant={seen ? 'secondary' : 'default'}
        onClick={() => setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' })}
      >
        <Check />
        {seen ? 'Remettre à voir' : 'Marquer comme vu'}
      </Button>

      {queue.available && (
        <Button
          variant="outline"
          className="h-10 w-full rounded-xl"
          aria-pressed={queue.queued}
          disabled={queue.pending}
          onClick={queue.toggle}
        >
          {queue.queued ? <ListMinus /> : <ListEnd />}
          {queue.queued
            ? `Retirer de la file (position ${(item.queue_position ?? 0) + 1})`
            : 'Ajouter à la file d’attente'}
        </Button>
      )}

      <div>
        <span className="mb-1 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Type
        </span>
        <Tabs
          value={resource.type}
          onValueChange={(v) =>
            update.mutate({ id: item.id, input: { type: v as ResourceType } })
          }
        >
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

      {/* keyed: editors keep local draft state per item */}
      <TagsEditor key={`tags-${item.id}`} item={item} />
      <NotesEditor key={`notes-${item.id}`} item={item} />

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="secondary"
          className="h-10 rounded-xl"
          nativeButton={false}
          render={<a href={resource.url} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink />
          Ouvrir le lien
        </Button>
        <Button variant="secondary" className="h-10 rounded-xl" onClick={() => dialogs.share(item)}>
          <Share2 />
          Partager
        </Button>
        <Button
          variant="secondary"
          className="h-10 rounded-xl"
          disabled={refresh.isPending}
          aria-label="Actualiser les métadonnées"
          title="Actualiser les métadonnées"
          onClick={() =>
            refresh.mutate(item.id, {
              onSuccess: (res) =>
                res.refreshed
                  ? toast.success('Métadonnées actualisées')
                  : toast.error('Impossible de récupérer les métadonnées. Réessaie plus tard.'),
            })
          }
        >
          <RefreshCw className={refresh.isPending ? 'animate-spin' : undefined} />
          Actualiser
        </Button>
        <Button
          variant="destructive"
          className="h-10 rounded-xl"
          onClick={() => dialogs.confirmDelete(item, onClose)}
        >
          <Trash2 />
          Supprimer
        </Button>
      </div>
    </div>
  )
}
