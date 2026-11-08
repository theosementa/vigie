import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useLeaving } from '@/hooks/useLeaving'
import { useIsDesktop } from '@/hooks/useIsMobile'
import { Chip } from '@/features/items/LibraryChips'
import type { SavedView } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useActiveView, useViews } from './queries'
import { useDeleteView } from './useDeleteView'
import { useViewDialogs } from './viewDialogsContext'

const LONG_PRESS_MS = 500
/** A finger moving further than this is scrolling the row, not pressing. */
const MOVE_PX = 8

/** A view chip: tap applies it, a long press (or the context menu) opens its actions. */
function ViewChip({
  view,
  active,
  onApply,
  onMenu,
}: {
  view: SavedView
  active: boolean
  onApply: () => void
  onMenu: () => void
}) {
  const timer = useRef<number>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  // The press already opened the menu: the click that follows must not also apply the view.
  const opened = useRef(false)
  const cancel = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }
  const open = () => {
    cancel()
    opened.current = true
    navigator.vibrate?.(8)
    onMenu()
  }
  return (
    <Chip
      active={active}
      className="vchip-btn"
      onClick={() => (opened.current ? (opened.current = false) : onApply())}
      onPointerDown={(e) => {
        opened.current = false
        if (e.pointerType === 'mouse') return
        origin.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(open, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > MOVE_PX) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!opened.current) open()
      }}
    >
      {/* Same icon as the sidebar entries: tells a view apart from the filter chips below. */}
      <Icon name="bookmark" bold={active} />
      <span className="truncate">{view.name}</span>
    </Chip>
  )
}

/** Phone and tablet portrait (the desktop sidebar lists the views otherwise): a scrolling row of chips. */
export function ViewChips() {
  const t = useT()
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const { data: views = [] } = useViews()
  const activeId = useActiveView()?.id
  const deleteView = useDeleteView()
  const dialogs = useViewDialogs()
  const rows = useLeaving(views)
  const [target, setTarget] = useState<SavedView | null>(null)
  // Keep the last target while the sheet closes, so its content does not blank mid-animation.
  const [last, setLast] = useState<SavedView | null>(null)
  if (target !== null && target !== last) setLast(target)
  const shown = target ?? last
  // The row opens its height only when the first view appears, not each time the page is shown.
  const [opens, setOpens] = useState(false)
  if (rows.length === 0 && !opens) setOpens(true)

  if (isDesktop || rows.length === 0) return null
  return (
    <>
      {/* Opens and closes its height as a block, so the library below never jumps. */}
      <div className={cn('vrow', rows.every((r) => r.leaving) ? 'vrow-out' : opens && 'vrow-in')}>
        <div className="chips" role="group" aria-label={t('views.label')}>
          {rows.map(({ item: view, leaving, arrived }) => (
            <span key={view.id} className={cn('vchip', leaving ? 'vchip-out' : arrived && 'vchip-in')} inert={leaving}>
              <ViewChip
                view={view}
                active={view.id === activeId}
                onApply={() =>
                  navigate(view.id === activeId ? { pathname: '/' } : { pathname: '/', search: view.query })
                }
                onMenu={() => setTarget(view)}
              />
            </span>
          ))}
        </div>
      </div>
      <Sheet open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-[20px] p-2 pb-[calc(0.5rem+var(--safe-bottom))] duration-[var(--dur-slow)] ease-[var(--ease)] data-[side=bottom]:data-ending-style:translate-y-full data-[side=bottom]:data-starting-style:translate-y-full">
          <SheetHeader>
            <SheetTitle className="truncate">{shown?.name}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1">
            <button
              type="button"
              className="btn btn-2 justify-start"
              onClick={() => {
                setTarget(null)
                if (shown) dialogs.rename(shown)
              }}
            >
              <Icon name="pen" />
              {t('view.rename')}
            </button>
            <button
              type="button"
              className="btn btn-danger justify-start"
              onClick={() => {
                setTarget(null)
                if (shown) deleteView(shown)
              }}
            >
              <Icon name="trash-bin-minimalistic" />
              {t('common.delete')}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
