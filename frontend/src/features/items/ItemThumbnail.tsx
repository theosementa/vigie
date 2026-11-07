import { useState } from 'react'
import { FileText, Play } from 'lucide-react'
import type { Resource } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ThumbResource = Pick<
  Resource,
  'url' | 'type' | 'image_url' | 'favicon_url' | 'duration_seconds'
>

const GRADIENTS = [
  'from-sky-400 to-indigo-500',
  'from-fuchsia-400 to-purple-500',
  'from-amber-300 to-rose-400',
  'from-emerald-300 to-teal-500',
  'from-orange-300 to-pink-500',
]

function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

/** 16:9 preview: image, or gradient + favicon fallback. Duration badge for videos. */
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
        <div
          className={cn(
            'flex size-full items-center justify-center bg-gradient-to-br',
            gradientFor(resource.url),
          )}
        >
          {resource.favicon_url && !faviconFailed ? (
            <img
              src={resource.favicon_url}
              alt=""
              onError={() => setFaviconFailed(true)}
              className="size-12 rounded-xl bg-white/90 p-2 shadow-md"
            />
          ) : resource.type === 'video' ? (
            <Play className="size-10 text-white/90" fill="currentColor" />
          ) : (
            <FileText className="size-10 text-white/90" />
          )}
        </div>
      )}
      {resource.type === 'video' && resource.duration_seconds != null && (
        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-sm">
          {formatDuration(resource.duration_seconds)}
        </span>
      )}
    </div>
  )
}
