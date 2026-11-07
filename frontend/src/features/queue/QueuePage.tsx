import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ListVideo } from 'lucide-react'
import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatWatchTime, plural } from '@/features/format'
import { useSetItemStatus } from '@/features/items/queries'
import { QueueEntry } from './QueueEntry'
import { queueDurations, reorder, useMoveInQueue, useQueue, useRemoveFromQueue } from './queries'

const instructions: ScreenReaderInstructions = {
  draggable:
    'Pour réorganiser la file, appuyez sur espace, déplacez avec les flèches haut et bas, puis appuyez sur espace pour déposer ou sur échap pour annuler.',
}

function makeAnnouncements(items: Item[]): Announcements {
  const title = (id: string | number) =>
    items.find((i) => i.id === id)?.resource.title ?? 'La vidéo'
  const pos = (id: string | number | undefined) =>
    id === undefined ? 0 : items.findIndex((i) => i.id === id) + 1
  return {
    onDragStart: ({ active }) => `${title(active.id)} saisie, position ${pos(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${title(active.id)} déplacée à la position ${pos(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} déposée à la position ${pos(over.id)}.`
        : `${title(active.id)} déposée.`,
    onDragCancel: ({ active }) => `Déplacement annulé, ${title(active.id)} reste à sa place.`,
  }
}

function QueueSkeleton() {
  return (
    <div role="status" aria-label="Chargement de la file d’attente" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse gap-3 rounded-2xl bg-card p-2 ring-1 ring-border">
          <div className="aspect-video w-28 shrink-0 rounded-xl bg-muted sm:w-40" />
          <div className="flex-1 space-y-2 py-2">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-4 w-4/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-border">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ListVideo className="size-7" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">Votre file d’attente est vide</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ajoutez des vidéos depuis votre bibliothèque pour décider de ce que vous regarderez ensuite.
      </p>
      <Button className="mt-1 rounded-xl" nativeButton={false} render={<Link to="/" />}>
        Parcourir la bibliothèque
      </Button>
    </div>
  )
}

/** "File d'attente": ordered videos to watch next, reorderable by drag-and-drop, keyboard or menu. */
export function QueuePage() {
  const { data, isPending, isError, refetch } = useQueue()
  const move = useMoveInQueue()
  const remove = useRemoveFromQueue()
  const setStatus = useSetItemStatus()
  // Order applied immediately on drop, so the list never snaps back while the optimistic update lands.
  const [override, setOverride] = useState<string[] | null>(null)

  const serverItems = useMemo(() => data?.items ?? [], [data])
  const items = useMemo(() => {
    if (!override) return serverItems
    const byId = new Map(serverItems.map((i) => [i.id, i]))
    const ordered = override.flatMap((id) => byId.get(id) ?? [])
    return ordered.length === serverItems.length ? ordered : serverItems
  }, [serverItems, override])
  const ids = useMemo(() => items.map((i) => i.id), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    setOverride(reorder(ids, from, to))
    move.mutate({ id: String(active.id), position: to }, { onSettled: () => setOverride(null) })
  }

  const onMove = useCallback(
    (item: Item, position: number) => move.mutate({ id: item.id, position }),
    [move],
  )
  const onSeen = useCallback(
    (item: Item) =>
      setStatus.mutate(
        { id: item.id, status: 'seen' },
        { onSuccess: () => toast('Marqué comme vu, retiré de la file') },
      ),
    [setStatus],
  )
  const onRemove = useCallback(
    (item: Item) =>
      remove.mutate(item.id, { onSuccess: () => toast('Retiré de la file d’attente') }),
    [remove],
  )

  if (isPending) return <QueueSkeleton />

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
        <p>Impossible de charger la file d’attente.</p>
        <button type="button" onClick={() => refetch()} className="mt-1 font-medium underline">
          Réessayer
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl md:p-6">
        <EmptyState />
      </div>
    )
  }

  const { seconds, unknown } = queueDurations(items)

  return (
    <div className="mx-auto max-w-3xl space-y-4 md:p-6">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-semibold text-foreground">
          {items.length} {plural(items.length, 'vidéo', 'vidéos')}
        </span>
        {' · '}
        {seconds > 0 ? `${formatWatchTime(seconds)} à regarder` : 'durée inconnue'}
        {seconds > 0 && unknown > 0 && ` (+ ${unknown} sans durée)`}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: makeAnnouncements(items), screenReaderInstructions: instructions }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3" aria-label="File d’attente">
            {items.map((item, index) => (
              <QueueEntry
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                onMove={onMove}
                onSeen={onSeen}
                onRemove={onRemove}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
