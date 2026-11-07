import { useIsDesktop } from '@/hooks/useIsMobile'
import { LibraryContent } from '../LibraryContent'
import type { Library } from '../useLibrary'
import { ItemDetailSideSheet } from './ItemDetailSideSheet'
import { ItemInspector } from './ItemInspector'

export function DesktopLibrary({ lib }: { lib: Library }) {
  const isDesktop = useIsDesktop()
  const { selected, close } = lib
  const showInspector = isDesktop && selected !== null

  return (
    <div className="flex min-w-0">
      <div className="min-w-0 flex-1 p-6">
        <LibraryContent
          lib={lib}
          className={
            showInspector
              ? 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
              : 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
          }
        />
      </div>
      {showInspector && <ItemInspector item={selected} onClose={close} />}
      {!isDesktop && <ItemDetailSideSheet item={selected} onClose={close} />}
    </div>
  )
}
