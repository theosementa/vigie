import { API_CACHE_NAME } from './swCaches'

/** Delete the service worker's API cache so a logged-out browser never replays the previous user's data. */
export async function clearApiCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(API_CACHE_NAME)
  } catch {
    // Cache API unavailable (private window, insecure context): nothing to clear.
  }
}
