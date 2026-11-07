import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'

/**
 * Entry sheet of the DA: full screen on a phone with the primary action pinned at the bottom,
 * centred modal from 768 px. Focus trap, Esc and the title link come from the dialog primitive.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  footer,
  width,
  initialFocus,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  footer?: ReactNode
  /** Modal width in px from 768 px up (default 480). */
  width?: number
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const t = useT()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup
          className="sheet"
          style={width ? ({ '--sheet-w': `${width}px` } as CSSProperties) : undefined}
          initialFocus={initialFocus}
        >
          <SheetHeader title={title} closeLabel={t('common.close')} />
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SheetHeader({ title, closeLabel }: { title: string; closeLabel: string }) {
  return (
    <div className="sheet-h">
      <Dialog.Title render={<h3 />}>{title}</Dialog.Title>
      <Dialog.Close className="icon-btn" aria-label={closeLabel}>
        <Icon name="close" small />
      </Dialog.Close>
    </div>
  )
}

/** Same header and body without the dialog, for the persistent inspector (>= 1280 px). */
export function Panel({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title: string
  onClose: () => void
  closeLabel: string
  children: ReactNode
}) {
  return (
    <aside className="inspector" aria-label={title}>
      <div className="sheet-h">
        <h3>{title}</h3>
        <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
          <Icon name="close" small />
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </aside>
  )
}
