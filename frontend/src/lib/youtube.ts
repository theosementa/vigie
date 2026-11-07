/**
 * Open a YouTube video in the YouTube app of a phone or tablet. From there the app's own Cast /
 * AirPlay button sends it to the TV, with no screen mirroring. Desktop browsers have no app to
 * open, so they keep the plain link (see `youtubeAppTarget`).
 */
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'])
const ID = /^[\w-]{6,20}$/

/** The video id of a YouTube URL (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const segments = u.pathname.split('/').filter(Boolean)
  let candidate: string | null = null
  if (host === 'youtu.be') candidate = segments[0] ?? null
  else if (HOSTS.has(host)) {
    if (u.pathname.replace(/\/$/, '') === '/watch') candidate = u.searchParams.get('v')
    else if (segments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(segments[0]!))
      candidate = segments[1]!
  }
  return candidate && ID.test(candidate) ? candidate : null
}

type Platform = 'ios' | 'android'

function platform(): Platform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  // iPadOS 13+ reports itself as a Mac: tell it apart by the touch screen.
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    return 'ios'
  return null
}

/**
 * Where the "Open in the YouTube app" button should go, or null when it should not be shown (not a
 * YouTube video, or not a phone/tablet).
 * - iOS: the app's custom scheme (works from Safari and from an installed PWA).
 * - Android: an intent URL, which falls back to the web page when the app is missing.
 */
export function youtubeAppTarget(url: string): string | null {
  const id = youtubeId(url)
  const os = platform()
  if (!id || !os) return null
  const web = `https://www.youtube.com/watch?v=${id}`
  if (os === 'ios') return `youtube://www.youtube.com/watch?v=${id}`
  return (
    `intent://www.youtube.com/watch?v=${id}#Intent;scheme=https;package=com.google.android.youtube;` +
    `S.browser_fallback_url=${encodeURIComponent(web)};end`
  )
}
