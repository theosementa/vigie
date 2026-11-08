import { useHiddenTypes } from '@/lib/hiddenTypes'
import type { ResourceType } from '@/lib/api'
import { RESOURCE_TYPES } from './metadata'

/**
 * The resource types offered to this user: all of them except the ones turned off in the settings.
 * Pass the type already in play (an item's own, a detected one, the active filter) to keep it listed.
 */
export function useResourceTypes(current?: ResourceType): ResourceType[] {
  const [hidden] = useHiddenTypes()
  return RESOURCE_TYPES.filter((type) => type === current || !hidden.includes(type))
}
