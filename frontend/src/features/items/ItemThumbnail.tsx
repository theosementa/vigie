import { useState } from 'react'
import { Icon } from '@/components/Icon'
import type { Resource } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ThumbResource = Pick<
  Resource,
  'url' | 'type' | 'image_url' | 'favicon_url' | 'duration_seconds'
>

/** 16:9 preview: image, or a neutral surface + favicon fallback. Duration badge for videos. */
export function ItemThumbnail({ resource, className }: { resource: ThumbResource; className?: string }) {
  const [failed, setFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const showImage = resource.image_url && !failed

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden bg-muted', className)}>
      {showImage ? (
        <img
          src={resource.image_url!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-surface-2">
          {resource.favicon_url && !faviconFailed ? (
            <img
              src={resource.favicon_url}
              alt=""
              onError={() => setFaviconFailed(true)}
              className="size-12 rounded-xl bg-surface p-2"
            />
          ) : resource.type === 'video' ? (
            <Icon name="play" className="size-10 text-muted-foreground" />
          ) : (
            <Icon name="document-text" className="size-10 text-muted-foreground" />
          )}
        </div>
      )}
      {resource.type === 'video' && resource.duration_seconds != null && (
        <span className="absolute right-2 bottom-2 rounded-md bg-bg/80 px-1.5 py-0.5 text-xs font-medium text-text tabular-nums">
          {formatDuration(resource.duration_seconds)}
        </span>
      )}
    </div>
  )
}
