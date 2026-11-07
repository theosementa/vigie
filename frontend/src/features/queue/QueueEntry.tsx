import { memo, type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Check,
  ExternalLink,
  GripVertical,
  ListMinus,
  MoreHorizontal,
} from 'lucide-react'
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
import { ItemThumbnail } from '@/features/items/ItemThumbnail'

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
  }

  const openVideo = () => window.open(resource.url, '_blank', 'noopener,noreferrer')

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('relative min-w-0', isDragging && 'z-10')}
      aria-label={`${index + 1} sur ${count} : ${title}`}
    >
      <article
        className={cn(
          'flex items-stretch gap-2 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-border transition-shadow',
          first && 'ring-2 ring-primary',
          isDragging && 'shadow-xl ring-2 ring-primary/60',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Réorganiser : ${title}. Position ${index + 1} sur ${count}. Espace pour saisir, flèches pour déplacer.`}
          className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>

        <div className="w-28 shrink-0 self-center overflow-hidden rounded-xl sm:w-40">
          <ItemThumbnail resource={resource} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
          <div className="flex items-center gap-1.5 text-xs">
            {first ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
                À suivre
              </span>
            ) : (
              <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
                #{index + 1}
              </span>
            )}
            <span className="truncate text-muted-foreground">
              {site}
              {resource.duration_seconds != null && ` · ${formatDuration(resource.duration_seconds)}`}
            </span>
          </div>
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {title}
              <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
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
                  variant="ghost"
                  aria-label={`Actions : ${title}`}
                  className="rounded-full"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={openVideo}>
                <ExternalLink />
                Ouvrir la vidéo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSeen(item)}>
                <Check />
                Marquer comme vu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={first} onClick={() => onMove(item, 0)}>
                <ArrowUpToLine />
                Placer en premier
              </DropdownMenuItem>
              <DropdownMenuItem disabled={first} onClick={() => onMove(item, index - 1)}>
                <ArrowUp />
                Monter
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onClick={() => onMove(item, index + 1)}>
                <ArrowDown />
                Descendre
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(item)}>
                <ListMinus />
                Retirer de la file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            aria-label={`Marquer comme vu : ${title}`}
            title="Marquer comme vu"
            onClick={() => onSeen(item)}
            className="rounded-full"
          >
            <Check />
          </Button>
        </div>
      </article>
    </li>
  )
}

export const QueueEntry = memo(QueueEntryBase)
