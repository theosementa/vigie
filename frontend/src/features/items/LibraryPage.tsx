import { useIsMobile } from '@/hooks/useIsMobile'
import { DesktopLibrary } from './desktop/DesktopLibrary'
import { MobileLibrary } from './mobile/MobileLibrary'
import { useLibrary } from './useLibrary'

/** Library (or "shared with me" when sharedOnly). */
export function LibraryPage({ sharedOnly = false }: { sharedOnly?: boolean }) {
  const isMobile = useIsMobile()
  const lib = useLibrary(sharedOnly)
  return isMobile ? <MobileLibrary lib={lib} /> : <DesktopLibrary lib={lib} />
}
