import { useState } from 'react'
import type { Item } from '@/lib/api'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Panel, Sheet } from '@/components/Sheet'
import { useT } from '@/lib/i18n'
import { ItemDetail } from './ItemDetail'
import { useStableCards } from './useStableCards'

/** Opened item: full-screen sheet on a phone, modal on a tablet, the right inspector from 1280 px. */
export function ItemDetailHost({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useT()
  const inspector = useMediaQuery('(min-width: 1280px)')
  useStableCards(inspector)
  // Keep the last opened item while the panel / sheet animates out, so its content does not blank mid-close.
  const [last, setLast] = useState(item)
  if (item && item !== last) setLast(item)
  const shown = item ?? last

  if (inspector)
    return (
      <Panel open={item !== null} title={t('item.details')} closeLabel={t('common.close')} onClose={onClose}>
        {shown && <ItemDetail item={shown} onClose={onClose} />}
      </Panel>
    )
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()} title={t('item.details')} width={560}>
      {shown && <ItemDetail item={shown} onClose={onClose} />}
    </Sheet>
  )
}
