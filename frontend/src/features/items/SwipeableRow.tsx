import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

const TRIGGER = 88
const MAX = 190
/** Distance past which the optional `extended` action replaces the primary one. */
const EXTENDED = 150
const LOCK_PX = 10

interface SwipeSide {
  label: string
  icon: ReactNode
  className: string
  onTrigger: () => void
  /** Secondary action reached by swiping further than EXTENDED. */
  extended?: Omit<SwipeSide, 'extended'>
}

/**
 * Horizontal swipe actions with plain pointer events (no gesture lib).
 * `right`: revealed when swiping right. `left`: revealed when swiping left.
 */
export function SwipeableRow({
  right,
  left,
  children,
}: {
  right: SwipeSide
  left: SwipeSide
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const locked = useRef(false)
  const swiped = useRef(false)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    locked.current = false
    swiped.current = false
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (!locked.current) {
      if (Math.abs(my) > LOCK_PX && Math.abs(my) > Math.abs(mx)) {
        start.current = null // vertical scroll, not ours
        return
      }
      if (Math.abs(mx) > LOCK_PX && Math.abs(mx) > Math.abs(my) * 1.5) {
        locked.current = true
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      } else return
    }
    setDx(Math.max(-MAX, Math.min(MAX, mx)))
  }

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    if (!locked.current) return
    locked.current = false
    swiped.current = true
    setDragging(false)
    const final = dx
    setDx(0)
    if (cancelled) return
    if (final >= EXTENDED && right.extended) right.extended.onTrigger()
    else if (final >= TRIGGER) right.onTrigger()
    else if (final <= -TRIGGER) left.onTrigger()
  }

  const side = dx > 0 ? (dx >= EXTENDED && right.extended ? right.extended : right) : left
  const progress = Math.min(1, Math.abs(dx) / TRIGGER)

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx !== 0 && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 flex items-center px-6 text-sm font-semibold text-white',
            dx > 0 ? 'justify-start' : 'justify-end',
            side.className,
          )}
          style={{ opacity: 0.4 + progress * 0.6 }}
        >
          <span className="flex items-center gap-2 [&_svg]:size-5">
            {side.icon}
            {side.label}
          </span>
        </div>
      )}
      <div
        onDragStart={(e) => e.preventDefault()} // no native image drag while swiping with a mouse
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault()
            e.stopPropagation()
            swiped.current = false
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  )
}
