import { useEffect } from 'react'

const CARD_MIN = 210
const GAP = 16
const PANEL = 380 + 28 // inspector width + the page margin it leaves

/**
 * Pins the library grid to the column count that fits with the inspector open, open or closed.
 * With `auto-fill` the count flips mid-resize (5 → 4 columns), so cards jump sideways while the
 * panel animates; pinned, they only grow and shrink. Sets `--cards-cols` on the root.
 */
export function useStableCards(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const main = document.querySelector<HTMLElement>('.main')
    if (!main) return
    const root = document.documentElement
    const apply = () => {
      const outer = main.getBoundingClientRect().width // does not change when the padding animates
      const padLeft = parseFloat(getComputedStyle(main).paddingLeft) || 0
      const openWidth = outer - padLeft - PANEL
      root.style.setProperty('--cards-cols', String(Math.max(1, Math.floor((openWidth + GAP) / (CARD_MIN + GAP)))))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(main)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--cards-cols')
    }
  }, [enabled])
}
