import type { BrandName } from '@/components/brands'

/** Host (and its subdomains) -> logo. A host not listed here has no logo. */
const PROVIDER_HOSTS: Record<BrandName, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  github: ['github.com'],
  gitlab: ['gitlab.com'],
  codeberg: ['codeberg.org'],
  spotify: ['spotify.com'],
  applepodcasts: ['podcasts.apple.com'],
  deezer: ['deezer.com'],
  soundcloud: ['soundcloud.com'],
  castbox: ['castbox.fm'],
  pocketcasts: ['pocketcasts.com', 'pca.st'],
  vimeo: ['vimeo.com'],
  dailymotion: ['dailymotion.com', 'dai.ly'],
  twitch: ['twitch.tv'],
  x: ['x.com', 'twitter.com'],
  reddit: ['reddit.com', 'redd.it'],
  ycombinator: ['ycombinator.com'],
  lobsters: ['lobste.rs'],
  medium: ['medium.com'],
  substack: ['substack.com'],
  hashnode: ['hashnode.com', 'hashnode.dev'],
  devdotto: ['dev.to'],
  wikipedia: ['wikipedia.org'],
  stackoverflow: ['stackoverflow.com', 'stackexchange.com'],
  npm: ['npmjs.com'],
  pypi: ['pypi.org'],
  huggingface: ['huggingface.co'],
  arxiv: ['arxiv.org'],
  notion: ['notion.so', 'notion.site'],
  figma: ['figma.com'],
  producthunt: ['producthunt.com'],
  bluesky: ['bsky.app'],
  mastodon: ['mastodon.social'],
  threads: ['threads.net'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com'],
  linkedin: ['linkedin.com'],
  telegram: ['t.me'],
  discord: ['discord.com', 'discord.gg'],
  imdb: ['imdb.com'],
  letterboxd: ['letterboxd.com'],
}

const BY_HOST = new Map<string, BrandName>(
  (Object.entries(PROVIDER_HOSTS) as [BrandName, string[]][]).flatMap(([brand, hosts]) =>
    hosts.map((host) => [host, brand] as const),
  ),
)

/** The logo of the provider behind a URL (`github.com/x/y` -> `github`), or null when it has none. */
export function providerOf(url: string): BrandName | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  // `open.spotify.com` -> try it, then `spotify.com`
  for (let h = host; h.includes('.'); h = h.slice(h.indexOf('.') + 1)) {
    const brand = BY_HOST.get(h)
    if (brand) return brand
  }
  return null
}
