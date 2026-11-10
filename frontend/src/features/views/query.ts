import { readFilters } from '@/features/items/useLibraryFilters'
import { ellipsize } from '@/lib/format'
import { t } from '@/lib/i18n'

/** Same limits as the server, which drops values over them. */
const MAX_TAG = 50
const MAX_SEARCH = 200
export const MAX_NAME = 40

/**
 * The library filters of a URL query in canonical form, the way the server stores a view's query:
 * only status / type / length / tag / q, sorted by key (types and tags repeated, sorted), defaults
 * (To watch, all types) left out.
 * "" means no filter. Compare canonical forms, never raw strings (`item=` and the order differ).
 */
export function canonicalQuery(source: string | URLSearchParams): string {
  const f = readFilters(new URLSearchParams(source))
  const byName = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0)
  const q = f.q.trim()
  const out = new URLSearchParams()
  if (f.length) out.set('length', f.length)
  if (q && q.length <= MAX_SEARCH) out.set('q', q)
  if (f.status === 'seen') out.set('status', 'seen')
  for (const tag of f.tag.filter((x) => x.length <= MAX_TAG).sort(byName)) out.append('tag', tag)
  for (const type of [...f.type].sort()) out.append('type', type)
  return out.toString()
}

/** "Videos · Under 10 min": the chips' labels for the filters in `query`, as a first name for a view. */
export function defaultViewName(query: string): string {
  const f = readFilters(new URLSearchParams(query))
  const parts = [
    ...f.type.map((type) => t(`filters.${type}`)),
    f.length && t(`filters.length.${f.length}`),
    ...f.tag.map((tag) => `#${tag}`),
    f.q.trim() && `“${f.q.trim()}”`,
    f.status === 'seen' && t('filters.seen'),
  ].filter(Boolean)
  return ellipsize(parts.join(' · '), MAX_NAME)
}
