import type { Item } from '@/lib/api'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Panel, Sheet } from '@/components/Sheet'
import { useT } from '@/lib/i18n'
import { ItemDetail } from './ItemDetail'

/** Opened item: full-screen sheet on a phone, modal on a tablet, the right inspector from 1280 px. */
export function ItemDetailHost({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useT()
  const inspector = useMediaQuery('(min-width: 1280px)')
  if (inspector)
    return item ? (
      <Panel title={t('item.details')} closeLabel={t('common.close')} onClose={onClose}>
        <ItemDetail item={item} onClose={onClose} />
      </Panel>
    ) : null
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()} title={t('item.details')} width={560}>
      {item && <ItemDetail item={item} onClose={onClose} />}
    </Sheet>
  )
}
