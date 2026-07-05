// Route remote poster/screenshot URLs through our own server so the visitor's
// real IP and Referer never reach Anixart/Shikimori CDNs (anonymity).
const PROXY_KEY = 'd3ffb0843f89eedefe80efec1dda7a2b97fa9645934a3ce4'
const BASE = 'https://aniapi.denanz.fun:8444'

export function img(url?: string): string {
  if (!url) return ''
  // Already local / data / blob — leave as-is
  if (!/^https?:\/\//i.test(url)) return url
  // Our own backend (screenshots) — already proxied
  if (url.startsWith(BASE)) return url
  return `${BASE}/api/v1/img?u=${encodeURIComponent(url)}&key=${PROXY_KEY}`
}
