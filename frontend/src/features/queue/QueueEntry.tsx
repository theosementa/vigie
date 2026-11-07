import { memo, type CSSProperties } from 'react'
import { Icon } from '@/components/Icon'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '@/lib/api'
import { formatDuration, hostname } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ItemThumb } from '@/features/items/ItemThumb'
import { useT } from '@/lib/i18n'

export interface QueueEntryHandlers {
  onMove: (item: Item, position: number) => void
  onSeen: (item: Item) => void
  onRemove: (item: Item) => void
}

interface QueueEntryProps extends QueueEntryHandlers {
  item: Item
  index: number
  count: number
}

function QueueEntryBase({ item, index, count, onMove, onSeen, onRemove }: QueueEntryProps) {
  const t = useT()
  const { resource } = item
  const title = resource.title ?? resource.url
  const site = resource.site_name ?? hostname(resource.url)
  const first = index === 0
  const last = index === count - 1

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--i': index % 8,
  } as CSSProperties

  const openVideo = () => window.open(resource.url, '_blank', 'noopener,noreferrer')

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('enter relative min-w-0', isDragging && 'z-10')}
      aria-label={t('queue.entry.label', { position: index + 1, count, title })}
    >
      <article
        className={cn(
          'flex items-stretch gap-2 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-border transition-shadow',
          isDragging && 'shadow-xl ring-2 ring-accent-ink/60',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('queue.entry.drag', { title, position: index + 1, count })}
          className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <Icon name="reorder" className="size-5" aria-hidden />
        </button>

        <div className="q-th w-28 shrink-0 self-center sm:w-40">
          <ItemThumb resource={resource} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
          <div className="flex items-center gap-1.5 text-xs">
            {first ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">
                {t('queue.next')}
              </span>
            ) : (
              <span className="shrink-0 font-medium text-muted-foreground tabular-nums">
                #{index + 1}
              </span>
            )}
            <span className="truncate text-muted-foreground">
              {site}
              {resource.duration_seconds != null && ` · ${formatDuration(resource.duration_seconds)}`}
            </span>
          </div>
          <h3 className="line-clamp-2 text-[15px] leading-snug font-medium">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {title}
              <span className="sr-only"> {t('common.new_tab')}</span>
            </a>
          </h3>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-between gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label={t('queue.entry.actions', { title })}
                  className="rounded-full"
                />
              }
            >
              <Icon name="menu-dots" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={openVideo}>
                <Icon name="arrow-right-up" />
                {t('queue.open')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSeen(item)}>
                <Icon name="check-circle" />
                {t('item.mark_seen')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={first} onClick={() => onMove(item, 0)}>
                <Icon name="arrow-up-to-line" />
                {t('queue.move_first')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={first} onClick={() => onMove(item, index - 1)}>
                <Icon name="arrow-up" />
                {t('queue.move_up')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onClick={() => onMove(item, index + 1)}>
                <Icon name="arrow-down" />
                {t('queue.move_down')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(item)}>
                <Icon name="list-minus-minimalistic" />
                {t('queue.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            aria-label={t('queue.entry.mark_seen', { title })}
            title={t('item.mark_seen')}
            onClick={() => onSeen(item)}
            className="rounded-full"
          >
            <Icon name="check-circle" />
          </Button>
        </div>
      </article>
    </li>
  )
}

export const QueueEntry = memo(QueueEntryBase)
