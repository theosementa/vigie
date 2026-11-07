import type { Item } from '@/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ItemDetail } from '../ItemDetail'

/** Tablet: side sheet from the right. */
export function ItemDetailSideSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[26rem] max-w-[90vw] sm:max-w-[26rem]">
        <SheetHeader>
          <SheetTitle>Détail</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {item && <ItemDetail item={item} onClose={onClose} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
