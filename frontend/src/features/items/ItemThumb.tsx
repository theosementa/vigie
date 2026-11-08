import { useState } from 'react'
import { Icon } from '@/components/Icon'
import type { Resource } from '@/lib/api'
import { formatCompact, formatDuration, formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { hasDuration, siteInitial } from './metadata'

export type ThumbResource = Pick<
  Resource,
  'url' | 'type' | 'image_url' | 'site_name' | 'duration_seconds' | 'stars'
>

/**
 * Thumbnail of the DA: the publisher's og:image, or the site-initial monogram on `--surface-2`
 * (also when the image fails to load). Videos and podcasts carry their duration, repositories their stars. Sizes come from the parent
 * (`.it .th`, `.card .th`, `.preview .th`, `.detail-th`); a seen or unavailable item is dimmed by
 * `.is-seen` / `.is-unknown` on an ancestor.
 */
export function ItemThumb({ resource, className }: { resource: ThumbResource; className?: string }) {
  const t = useT()
  return (
    <div className={cn('th', className)}>
      {/* keyed: a new image gets a fresh error state */}
      <ThumbImage key={resource.image_url ?? ''} resource={resource} />
      {hasDuration(resource.type) && resource.duration_seconds != null && (
        <span className="dur">{formatDuration(resource.duration_seconds)}</span>
      )}
      {resource.type === 'repo' && resource.stars != null && (
        <span className="dur" title={t('item.stars', { count: formatNumber(resource.stars) })}>
          <Icon name="star" />
          {formatCompact(resource.stars)}
        </span>
      )}
    </div>
  )
}

/**
 * YouTube serves `hqdefault` (480x360, letterboxed) by default, which looks soft on a retina card.
 * `maxresdefault` is 1280x720 but missing on some videos: we try it first and fall back to the stored URL.
 */
const YT_HQ = /^(https:\/\/i\.ytimg\.com\/vi\/[\w-]+\/)hqdefault\.jpg(\?.*)?$/

function sharperUrl(url: string): string {
  const m = YT_HQ.exec(url)
  return m ? `${m[1]}maxresdefault.jpg` : url
}

function ThumbImage({ resource }: { resource: ThumbResource }) {
  const original = resource.image_url
  const [src, setSrc] = useState(original ? sharperUrl(original) : null)
  const [failed, setFailed] = useState(false)
  // Podcast covers are square: shown whole over a blurred copy of themselves, not cropped to the card.
  const whole = resource.type === 'podcast'
  if (src && !failed)
    return (
      <>
        {whole && (
          <img className="og-bg" src={src} alt="" aria-hidden="true" referrerPolicy="no-referrer" decoding="async" />
        )}
        <img
          className={whole ? 'og contain' : 'og'}
          src={src}
          alt=""
          // Publishers' image hosts often refuse a foreign Referer.
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => (original && src !== original ? setSrc(original) : setFailed(true))}
        />
      </>
    )
  return (
    <span className="mono" aria-hidden="true">
      {siteInitial(resource)}
    </span>
  )
}
