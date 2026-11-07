import type { Item } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { ItemDetail } from '../ItemDetail'

/** Desktop: persistent right panel, the grid stays visible. */
export function ItemInspector({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <aside
      aria-label="Détail de l'élément"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-96 shrink-0 flex-col border-l bg-card lg:flex"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">Détail</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer le détail">
          <Icon name="close" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ItemDetail item={item} onClose={onClose} />
      </div>
    </aside>
  )
}
