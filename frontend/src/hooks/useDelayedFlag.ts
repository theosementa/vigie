import { useEffect, useState } from 'react'

/**
 * `active`, but only once it has lasted `delay` ms. Used for loading skeletons: a fetch that
 * answers within a few frames (an empty tab, a cached query) shows nothing instead of a flash.
 */
export function useDelayedFlag(active: boolean, delay = 200): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setElapsed(true), delay)
    return () => {
      clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, delay])
  return active && elapsed
}
