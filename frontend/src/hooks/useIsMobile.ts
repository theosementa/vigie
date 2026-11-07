import { useMediaQuery } from './useMediaQuery'

export const MOBILE_BREAKPOINT = 768
export const DESKTOP_BREAKPOINT = 1024

/** < 768px: iOS-style mobile experience. */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

/** >= 1024px: full desktop (inspector panel, expanded sidebar). Between is "tablet". */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
}
