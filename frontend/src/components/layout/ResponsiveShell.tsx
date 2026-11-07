import { useIsMobile } from '@/hooks/useIsMobile'
import { DesktopShell } from './DesktopShell'
import { MobileShell } from './MobileShell'

/** One build, one URL: the layout only switches by viewport (768px). */
export function ResponsiveShell() {
  return useIsMobile() ? <MobileShell /> : <DesktopShell />
}
