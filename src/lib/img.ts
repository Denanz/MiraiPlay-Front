// Прогоняем постеры и кадры через свой сервер, чтобы настоящий IP и Referer
// посетителя не доходили до чужих CDN.
const PROXY_KEY = 'd3ffb0843f89eedefe80efec1dda7a2b97fa9645934a3ce4'
const BASE = 'https://aniapi.denanz.fun:8444'

export function img(url?: string): string {
  if (!url) return ''
  // Уже локальное, data или blob — оставляем как есть
  if (!/^https?:\/\//i.test(url)) return url
  // Наш же бэкенд со скриншотами — уже проксировано
  if (url.startsWith(BASE)) return url
  return `${BASE}/api/v1/img?u=${encodeURIComponent(url)}&key=${PROXY_KEY}`
}
