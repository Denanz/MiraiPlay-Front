import { api } from '../api/client'

/**
 * Личные оценки тайтлов для плиток каталога и главной.
 *
 * Загружаются один раз за сессию и лежат в памяти: плиток на экране десятки,
 * и ходить за оценкой на каждую — бессмысленный шквал запросов. Подписка нужна,
 * потому что карточки рендерятся раньше, чем приходит ответ.
 */

let cache: Record<string, number> | null = null
let inflight: Promise<Record<string, number>> | null = null
const listeners = new Set<() => void>()

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export function getMyRating(releaseId: string | number): number {
  return cache?.[String(releaseId)] ?? 0
}

/** Сообщаем подписчикам, что оценки приехали или изменились. */
function notify(): void {
  for (const fn of listeners) fn()
}

export function subscribeMyRatings(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function loadMyRatings(): Promise<Record<string, number>> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  if (!token()) return Promise.resolve({})
  inflight = api
    .get<{ ratings: Record<string, number> }>('/api/v1/player/rating/all', { params: { token: token() } })
    .then(({ data }) => {
      cache = data?.ratings ?? {}
      notify()
      return cache
    })
    .catch(() => {
      cache = {}
      return cache
    })
    .finally(() => { inflight = null })
  return inflight
}

/** Локальное обновление после выставления оценки — чтобы плитки не ждали перезагрузки. */
export function setMyRatingLocal(releaseId: string | number, rating: number): void {
  cache = cache ?? {}
  if (rating > 0) cache[String(releaseId)] = rating
  else delete cache[String(releaseId)]
  notify()
}
