import { useCallback, useState } from 'react'

export const ZOOM_LOCK_STORAGE_KEY = 'vigie-zoom-lock'
const VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover'
const LOCKED_VIEWPORT = `${VIEWPORT}, maximum-scale=1.0, user-scalable=no`

/** On by default: only an explicit "0" turns the lock off. */
export function readZoomLock(): boolean {
  try {
    return localStorage.getItem(ZOOM_LOCK_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

/** Pin the page scale on a phone (no pinch / double-tap zoom). Also read by public/theme-init.js before first paint. */
export function applyZoomLock(locked: boolean) {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', locked ? LOCKED_VIEWPORT : VIEWPORT)
  try {
    localStorage.setItem(ZOOM_LOCK_STORAGE_KEY, locked ? '1' : '0')
  } catch {
    // storage unavailable: the choice lasts for this session only
  }
}

/** Zoom lock preference. Kept on the device (zoom is a per-device matter), not on the account. */
export function useZoomLock(): [boolean, (locked: boolean) => void] {
  const [locked, setLocked] = useState(readZoomLock)
  const set = useCallback((next: boolean) => {
    applyZoomLock(next)
    setLocked(next)
  }, [])
  return [locked, set]
}
