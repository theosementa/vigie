import type { Item } from '@/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ItemDetail } from '../ItemDetail'

/** Mobile: full-height sheet sliding up from the bottom. */
export function ItemDetailBottomSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="data-[side=bottom]:h-[calc(100dvh-var(--safe-top)-0.75rem)] gap-0 rounded-t-3xl pb-safe"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="pb-0">
          <SheetTitle>Détail</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{item && <ItemDetail item={item} onClose={onClose} />}</div>
      </SheetContent>
    </Sheet>
  )
}
