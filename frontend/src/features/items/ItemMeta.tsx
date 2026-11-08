import { Icon } from '@/components/Icon'
import type { Item } from '@/lib/api'
import { BrandIcon } from '@/components/BrandIcon'
import { formatMinutesShort, formatRelativeDay, fullName } from '@/lib/format'
import { providerOf } from '@/lib/providers'
import { useT } from '@/lib/i18n'
import { isMetadataUnavailable, siteOf } from './metadata'

/** Types whose link is a plain web page: they get a globe when the site has no known logo. */
const isWebLink = (type: string) => type === 'article' || type === 'website'
import { useRefreshWithToast } from './useRefreshItem'

/**
 * Meta line of a row or a card: `site · 12 min`, led by the provider's logo when it has one. A seen
 * item says when it was seen (with a check instead of the logo), and unavailable metadata offers « Réessayer ».
 */
export function ItemMeta({ item }: { item: Item }) {
  const t = useT()
  const { resource } = item
  const refresh = useRefreshWithToast()

  if (isMetadataUnavailable(resource))
    return (
      <div className="meta">
        <span className="min-w-0 truncate">{t('item.unavailable')}</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="link-btn above"
          disabled={refresh.pending}
          onClick={() => refresh.refresh(item.id)}
        >
          {t('common.retry')}
        </button>
      </div>
    )

  const seen = item.status === 'seen'
  const brand = providerOf(resource.url)
  const detail = item.shared_by
    ? fullName(item.shared_by)
    : resource.type === 'article' && resource.reading_time_minutes != null
      ? formatMinutesShort(resource.reading_time_minutes)
      : resource.type === 'video' || resource.type === 'podcast'
        ? resource.author
        : null
  const parts = [
    seen && item.seen_at ? t('item.seen_when', { when: formatRelativeDay(item.seen_at) }) : null,
    siteOf(resource),
    detail,
  ].filter(Boolean)

  return (
    <div className="meta">
      {seen ? <Icon name="check-circle" /> : brand ? <BrandIcon name={brand} /> : isWebLink(resource.type) && <Icon name="global" />}
      <span className="min-w-0 truncate">{parts.join(' · ')}</span>
      {item.queue_position !== null && (
        <span className="inline-flex shrink-0 items-center gap-1" title={t('item.in_queue', { position: item.queue_position + 1 })}>
          <Icon name="playlist-minimalistic" />
          {item.queue_position + 1}
        </span>
      )}
    </div>
  )
}
