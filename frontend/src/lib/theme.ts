import type { Theme } from './api'

export const THEME_STORAGE_KEY = 'vigie-theme'

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Point <meta name="theme-color"> at the current --bg so the browser chrome matches the app. */
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!bg) return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = bg
}

/**
 * Apply a theme: `dark` / `light` pin data-theme, `system` removes it so tokens.css follows the OS.
 * Also remembered in localStorage (read by public/theme-init.js before first paint).
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage unavailable: the choice still lasts for this session and is saved server-side
  }
  syncThemeColor()
}
