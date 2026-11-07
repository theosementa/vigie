import { memo } from 'react'
import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
import { formatReadingTime, formatShortDate, fullName, hostname } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TagChip } from '@/features/tags/TagChip'
import { ActionsContextContent, ActionsDropdownContent } from './itemActions'
import { useItemActions } from './useItemActions'
import { ItemThumbnail } from './ItemThumbnail'
import { useSetItemStatus } from './queries'

interface ItemCardProps {
  item: Item
  selected?: boolean
  onOpen: (item: Item) => void
}

function ItemCardBase({ item, selected, onOpen }: ItemCardProps) {
  const { resource } = item
  const setStatus = useSetItemStatus()
  const actions = useItemActions(item, () => onOpen(item))
  const seen = item.status === 'seen'
  const site = resource.site_name ?? hostname(resource.url)

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <article
            className={cn(
              'group relative overflow-hidden rounded-2xl bg-card text-card-foreground shadow-sm ring-1 ring-border transition-shadow hover:shadow-md',
              selected && 'ring-2 ring-accent-ink',
            )}
          />
        }
      >
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Ouvrir : ${resource.title ?? site}`}
        >
          <div className="relative">
            <ItemThumbnail resource={resource} className={cn(seen && 'opacity-70')} />
            {item.queue_position !== null && (
              <span
                className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums shadow-sm"
                title={`Dans la file d’attente, position ${item.queue_position + 1}`}
              >
                <Icon name="playlist-minimalistic" className="size-3" aria-hidden />
                <span className="sr-only">Dans la file d’attente, position </span>
                {item.queue_position + 1}
              </span>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {resource.favicon_url && (
                <img src={resource.favicon_url} alt="" className="size-4 rounded-sm" loading="lazy" />
              )}
              <span className="truncate">{site}</span>
              {resource.type === 'article' && resource.reading_time_minutes != null && (
                <span className="shrink-0">· {formatReadingTime(resource.reading_time_minutes)}</span>
              )}
              {seen && item.seen_at && (
                <span className="shrink-0">· Vu le {formatShortDate(item.seen_at)}</span>
              )}
            </div>
            <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">
              {resource.title ?? resource.url}
            </h3>
            {(item.tags.length > 0 || item.shared_by) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {item.shared_by && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-accent-ink">
                    <Icon name="users-group-rounded" className="size-3" />
                    Partagé par {fullName(item.shared_by)}
                  </span>
                )}
                {item.tags.map((t) => (
                  <TagChip key={t.id} name={t.name} />
                ))}
              </div>
            )}
          </div>
        </button>

        <div className="absolute top-2 right-2 left-2 flex items-start justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            aria-pressed={seen}
            aria-label={seen ? 'Marquer comme à voir' : 'Marquer comme vu'}
            onClick={() =>
              setStatus.mutate({ id: item.id, status: seen ? 'to_watch' : 'seen' })
            }
            className={cn(
              'rounded-full bg-surface/90 ring-1 ring-line',
              seen && 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            <Icon name="check-circle" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label="Actions"
                  className="rounded-full bg-surface/90 ring-1 ring-line md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-popup-open:opacity-100"
                />
              }
            >
              <Icon name="menu-dots" />
            </DropdownMenuTrigger>
            <ActionsDropdownContent actions={actions} />
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ActionsContextContent actions={actions} />
    </ContextMenu>
  )
}

export const ItemCard = memo(ItemCardBase)
