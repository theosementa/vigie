import { useMe } from '@/features/auth/useAuth'
import type { ResourceType } from '@/lib/api'
import { RESOURCE_TYPES } from './metadata'

/**
 * The resource types offered to this user. "Repository" is a developer thing, so it can be turned off
 * in the settings; pass the type already in play (an item's own, a detected one) to keep it listed.
 */
export function useResourceTypes(current?: ResourceType): ResourceType[] {
  const { data: me } = useMe()
  const showRepos = me?.show_repos ?? true
  return RESOURCE_TYPES.filter((type) => type !== 'repo' || showRepos || current === 'repo')
}
