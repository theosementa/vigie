import { memo, type CSSProperties } from 'react'
import { BrandIcon } from '@/components/BrandIcon'
import { Icon } from '@/components/Icon'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '@/lib/api'
import { formatDuration, hostname } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionsContextContent, ActionsDropdownContent } from '@/features/items/itemActions'
import type { Action } from '@/features/items/useItemActions'
import { ItemThumb } from '@/features/items/ItemThumb'
import { useT } from '@/lib/i18n'
import { providerOf } from '@/lib/providers'

export interface QueueEntryHandlers {
  onMove: (item: Item, position: number) => void
  onSeen: (item: Item) => void
  onRemove: (item: Item) => void
  onOpenDetail: (item: Item) => void
}

interface QueueEntryProps extends QueueEntryHandlers {
  item: Item
  index: number
  count: number
}

function QueueEntryBase({ item, index, count, onMove, onSeen, onRemove, onOpenDetail }: QueueEntryProps) {
  const t = useT()
  const { resource } = item
  const title = resource.title ?? resource.url
  const site = resource.site_name ?? hostname(resource.url)
  const brand = providerOf(resource.url)
  const first = index === 0
  const last = index === count - 1

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--i': index % 8,
  } as CSSProperties

  const actions: Action[] = [
    {
      key: 'open',
      label: t('queue.open'),
      icon: <Icon name="arrow-right-up" />,
      run: () => window.open(resource.url, '_blank', 'noopener,noreferrer'),
    },
    { key: 'details', label: t('item.details'), icon: <Icon name="info-circle" />, run: () => onOpenDetail(item) },
    { key: 'seen', label: t('item.mark_seen'), icon: <Icon name="check-circle" />, run: () => onSeen(item) },
    {
      key: 'first',
      label: t('queue.move_first'),
      icon: <Icon name="arrow-up-to-line" />,
      separatorBefore: true,
      disabled: first,
      run: () => onMove(item, 0),
    },
    { key: 'up', label: t('queue.move_up'), icon: <Icon name="arrow-up" />, disabled: first, run: () => onMove(item, index - 1) },
    { key: 'down', label: t('queue.move_down'), icon: <Icon name="arrow-down" />, disabled: last, run: () => onMove(item, index + 1) },
    {
      key: 'remove',
      label: t('queue.remove'),
      icon: <Icon name="list-minus-minimalistic" />,
      destructive: true,
      run: () => onRemove(item),
    },
  ]

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('enter relative min-w-0', isDragging && 'z-10')}
      aria-label={t('queue.entry.label', { position: index + 1, count, title })}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <article
              className={cn(
                'q-row flex items-stretch gap-2 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-border transition-shadow data-popup-open:ring-2 data-popup-open:ring-accent-ink/60',
                isDragging && 'shadow-xl ring-2 ring-accent-ink/60',
              )}
            />
          }
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

          <div className="q-th">
            <ItemThumb resource={resource} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
            <div className="flex items-center gap-1.5 text-xs">
              {first ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">
                  {t('queue.next')}
                </span>
              ) : (
                <span className="shrink-0 font-medium text-muted-foreground tabular-nums">#{index + 1}</span>
              )}
              {brand ? <BrandIcon name={brand} className="size-3.5 shrink-0 text-muted-foreground" /> : <Icon name="global" className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 truncate text-muted-foreground">
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

          <div className="q-actions flex shrink-0 items-start">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('queue.entry.actions', { title })}
                    title={t('item.actions')}
                  />
                }
              >
                <Icon name="menu-dots" small />
              </DropdownMenuTrigger>
              <ActionsDropdownContent actions={actions} />
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ActionsContextContent actions={actions} />
      </ContextMenu>
    </li>
  )
}

export const QueueEntry = memo(QueueEntryBase)
