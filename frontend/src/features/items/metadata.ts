import type { IconBase } from '@/components/Icon'
import type { Item, Resource, ResourceType } from '@/lib/api'
import { hostname } from '@/lib/format'

type Meta = Pick<Resource, 'url' | 'title' | 'site_name' | 'description' | 'image_url'>

/**
 * The server never fails a capture over metadata: when the page did not answer, the item keeps the
 * hostname as its title and has no site name, description or image. That is the "unavailable" state.
 */
export function isMetadataUnavailable(r: Meta): boolean {
  const host = hostname(r.url)
  return !r.site_name && !r.description && !r.image_url && (r.title === host || r.title === r.url)
}

export function siteOf(r: Pick<Resource, 'url' | 'site_name'>): string {
  return r.site_name ?? hostname(r.url)
}

/** First letter of the site, for the monogram thumbnail. */
export function siteInitial(r: Pick<Resource, 'url' | 'site_name'>): string {
  const letter = siteOf(r).match(/\p{L}|\p{N}/u)?.[0]
  return (letter ?? '?').toUpperCase()
}

export const isSeen = (item: Pick<Item, 'status'>) => item.status === 'seen'

export const RESOURCE_TYPES: ResourceType[] = ['article', 'video', 'podcast', 'website', 'repo']

/** Videos and podcasts are measured in time listened or watched; the rest in reading time. */
export const hasDuration = (type: ResourceType) => type === 'video' || type === 'podcast'

export const TYPE_ICON: Record<ResourceType, IconBase> = {
  article: 'document-text',
  video: 'videocamera',
  podcast: 'microphone-3',
  website: 'global',
  repo: 'code-square',
}
