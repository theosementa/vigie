import { useLayoutEffect, useRef, type RefObject } from 'react'

/** More rows than this appearing or disappearing at once is a new list (filter, page), not a move. */
const MAX_CHANGED = 2

type Positions = Map<string, { x: number; y: number }>

/** Position of every child (keyed by `data-id`) relative to the container, transforms included. */
function measure(container: HTMLElement): Positions {
  const origin = container.getBoundingClientRect()
  const positions: Positions = new Map()
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const rect = child.getBoundingClientRect()
    positions.set(child.dataset.id ?? '', { x: rect.left - origin.left, y: rect.top - origin.top })
  }
  return positions
}

/** A CSS time ("200ms"; the production build minifies it to ".2s"). */
const toMs = (time: string) => parseFloat(time) * (time.trim().endsWith('ms') ? 1 : 1000)

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const isSliding = (container: HTMLElement) =>
  Array.from(container.children).some((c) => c.getAnimations().some((a) => a.id === 'flip'))

/**
 * FLIP for a grid whose children (`data-id`, in the order of `ids`) come and go: when the set
 * changes, the others slide from their old place to the new one instead of snapping into the gap.
 * The old places are the layout of the previous commit, kept fresh while the grid resizes, so a
 * change that lands in the middle of the inspector's resize still starts from where the card is.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, ids: string[], enabled: boolean) {
  const signature = ids.join()
  const last = useRef<{ signature: string; positions: Positions } | null>(null)

  useLayoutEffect(() => {
    const container = ref.current
    if (!enabled || !container) {
      last.current = null
      return
    }
    const previous = last.current
    // Running slides would pollute the measure: end them, the new ones start from the old places.
    for (const child of Array.from(container.children)) {
      child.getAnimations().forEach((a) => a.id === 'flip' && a.cancel())
    }
    const after = measure(container)
    last.current = { signature, positions: after }
    if (!previous || previous.signature === signature) return
    if (prefersReducedMotion()) return

    const before = previous.positions
    const changed =
      [...before.keys()].filter((id) => !after.has(id)).length +
      [...after.keys()].filter((id) => !before.has(id)).length
    if (changed > MAX_CHANGED) return

    const style = getComputedStyle(document.documentElement)
    const duration = toMs(style.getPropertyValue('--dur-base'))
    const easing = style.getPropertyValue('--ease').trim()
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const from = before.get(child.dataset.id ?? '')
      const to = after.get(child.dataset.id ?? '')
      if (!from || !to || child.classList.contains('leaving')) continue
      const dx = from.x - to.x
      const dy = from.y - to.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      const slide = child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing },
      )
      slide.id = 'flip'
    }
  }, [signature, enabled, ref])

  // The layout also changes without a new set of rows (inspector, window): keep the old places true.
  useLayoutEffect(() => {
    const container = ref.current
    if (!enabled || !container) return
    const ro = new ResizeObserver(() => {
      if (last.current && !isSliding(container)) last.current.positions = measure(container)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [enabled, ref])
}
