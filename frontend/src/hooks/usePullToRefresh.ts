import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72
const MAX_PULL = 110

/**
 * iOS-style pull-to-refresh using touch events (page scrolled to the top, pull down).
 * Returns the current pull distance (for the indicator) and whether a refresh is running.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>, enabled = true) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef(onRefresh)
  useEffect(() => {
    refreshRef.current = onRefresh
  })

  useEffect(() => {
    if (!enabled) return
    let startX = 0
    let startY = 0
    let tracking = false
    let current = 0
    let busy = false

    const onStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0 || e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
      current = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        current = 0
        setPull(0)
        return
      }
      current = Math.min(MAX_PULL, dy * 0.5)
      setPull(current)
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (current >= THRESHOLD * 0.75 && !busy) {
        busy = true
        setRefreshing(true)
        setPull(THRESHOLD * 0.6)
        void refreshRef.current().finally(() => {
          busy = false
          setRefreshing(false)
          setPull(0)
        })
      } else {
        setPull(0)
      }
      current = 0
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled])

  return { pull, refreshing }
}
