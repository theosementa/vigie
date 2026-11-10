import { useHiddenTypes } from '@/lib/hiddenTypes'
import type { ResourceType } from '@/lib/api'
import { RESOURCE_TYPES } from './metadata'

/**
 * The resource types offered to this user: all of them except the ones turned off in the settings.
 * Pass the types already in play (an item's own, a detected one, the active filters) to keep them listed.
 */
export function useResourceTypes(current?: ResourceType | readonly ResourceType[]): ResourceType[] {
  const [hidden] = useHiddenTypes()
  const keep = current === undefined ? [] : typeof current === 'string' ? [current] : current
  return RESOURCE_TYPES.filter((type) => keep.includes(type) || !hidden.includes(type))
}
