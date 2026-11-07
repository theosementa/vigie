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
  // Last non-zero offset: keeps the action layer mounted while the row slides back.
  const [shown, setShown] = useState(0)
  const armed = useRef(false)
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
    const next = Math.max(-MAX, Math.min(MAX, mx))
    setDx(next)
    if (next !== 0) setShown(next)
    // Short tick the moment the swipe becomes strong enough to trigger.
    const isArmed = Math.abs(next) >= TRIGGER
    if (isArmed && !armed.current) navigator.vibrate?.(8)
    armed.current = isArmed
  }

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    if (!locked.current) return
    locked.current = false
    swiped.current = true
    setDragging(false)
    armed.current = false
    const final = dx
    setDx(0)
    if (cancelled) return
    if (final >= EXTENDED && right.extended) right.extended.onTrigger()
    else if (final >= TRIGGER) right.onTrigger()
    else if (final <= -TRIGGER) left.onTrigger()
  }

  const side = shown > 0 ? (dx >= EXTENDED && right.extended ? right.extended : right) : left
  const progress = Math.min(1, Math.abs(dx) / TRIGGER)
  const reached = progress >= 1

  return (
    <div className="relative overflow-hidden">
      {shown !== 0 && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 flex items-center px-6 text-sm font-medium',
            shown > 0 ? 'justify-start' : 'justify-end',
            side.className,
          )}
          style={{
            opacity: dx === 0 ? 0 : 0.4 + progress * 0.6,
            transition: dragging ? 'none' : 'opacity 200ms var(--ease)',
          }}
        >
          <span
            className="flex items-center gap-2 transition-transform duration-150 [&_svg]:size-5"
            style={{ transform: reached ? 'scale(1.08)' : 'scale(1)' }}
          >
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
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && dx === 0) setShown(0)
        }}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault()
            e.stopPropagation()
            swiped.current = false
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 260ms var(--ease)',
          touchAction: 'pan-y',
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  )
}
