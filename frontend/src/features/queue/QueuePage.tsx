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
import { toast } from 'sonner'
import type { Item } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatWatchTime } from '@/features/stats/format'
import { useT, type TFunction } from '@/lib/i18n'
import { useSetItemStatus } from '@/features/items/queries'
import { QueueEntry } from './QueueEntry'
import { queueDurations, reorder, useMoveInQueue, useQueue, useRemoveFromQueue } from './queries'

const makeInstructions = (t: TFunction): ScreenReaderInstructions => ({
  draggable: t('queue.dnd.instructions'),
})

function makeAnnouncements(items: Item[], t: TFunction): Announcements {
  const title = (id: string | number) =>
    items.find((i) => i.id === id)?.resource.title ?? t('queue.dnd.video')
  const pos = (id: string | number | undefined) =>
    id === undefined ? 0 : items.findIndex((i) => i.id === id) + 1
  return {
    onDragStart: ({ active }) => t('queue.dnd.start', { title: title(active.id), position: pos(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('queue.dnd.over', { title: title(active.id), position: pos(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('queue.dnd.end', { title: title(active.id), position: pos(over.id) })
        : t('queue.dnd.dropped', { title: title(active.id) }),
    onDragCancel: ({ active }) => t('queue.dnd.cancel', { title: title(active.id) }),
  }
}

function QueueSkeleton() {
  const t = useT()
  return (
    <div role="status" aria-label={t('common.loading')} className="space-y-3">
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
  const t = useT()
  return (
    <div className="empty">
      <div className="ghost">{t('empty.ghost.queue')}</div>
      <p>{t('queue.empty.body')}</p>
      <div className="btns">
        <Button className="btn btn-accent btn-sm" nativeButton={false} render={<Link to="/" />}>
          {t('queue.empty.cta')}
        </Button>
      </div>
    </div>
  )
}

/** "File d'attente": ordered videos to watch next, reorderable by drag-and-drop, keyboard or menu. */
export function QueuePage() {
  const t = useT()
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
    (item: Item) => setStatus.mutate({ id: item.id, status: 'seen' }),
    [setStatus],
  )
  const onRemove = useCallback(
    (item: Item) =>
      remove.mutate(item.id, { onSuccess: () => toast(t('queue.removed')) }),
    [remove, t],
  )

  if (isPending) return <QueueSkeleton />

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
        <p>{t('queue.error')}</p>
        <button type="button" onClick={() => refetch()} className="mt-1 font-medium underline">
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="lib">
        <EmptyState />
      </div>
    )
  }

  const { seconds, unknown } = queueDurations(items)

  return (
    <div className="lib">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">
          {t('queue.count', { count: items.length })}
        </span>
        {' · '}
        {seconds > 0 ? t('queue.watch_time', { time: formatWatchTime(seconds) }) : t('queue.duration_unknown')}
        {seconds > 0 && unknown > 0 && ` ${t('queue.no_duration', { count: unknown })}`}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: makeAnnouncements(items, t), screenReaderInstructions: makeInstructions(t) }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3" aria-label={t('title.queue')}>
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
