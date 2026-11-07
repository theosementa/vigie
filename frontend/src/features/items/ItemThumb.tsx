import { useState } from 'react'
import type { Resource } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { siteInitial } from './metadata'

export type ThumbResource = Pick<
  Resource,
  'url' | 'type' | 'image_url' | 'site_name' | 'duration_seconds'
>

/**
 * Thumbnail of the DA: the publisher's og:image, or the site-initial monogram on `--surface-2`
 * (also when the image fails to load). Videos carry their duration. Sizes come from the parent
 * (`.it .th`, `.card .th`, `.preview .th`, `.detail-th`); a seen or unavailable item is dimmed by
 * `.is-seen` / `.is-unknown` on an ancestor.
 */
export function ItemThumb({ resource, className }: { resource: ThumbResource; className?: string }) {
  return (
    <div className={cn('th', className)}>
      {/* keyed: a new image gets a fresh error state */}
      <ThumbImage key={resource.image_url ?? ''} resource={resource} />
      {resource.type === 'video' && resource.duration_seconds != null && (
        <span className="dur">{formatDuration(resource.duration_seconds)}</span>
      )}
    </div>
  )
}

function ThumbImage({ resource }: { resource: ThumbResource }) {
  const [failed, setFailed] = useState(false)
  if (resource.image_url && !failed)
    return (
      <img
        className="og"
        src={resource.image_url}
        alt=""
        // Publishers' image hosts often refuse a foreign Referer.
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  return (
    <span className="mono" aria-hidden="true">
      {siteInitial(resource)}
    </span>
  )
}
