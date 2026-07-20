import { api } from '../api/client'

/**
 * Оценки Shikimori (десятибалльные) для плиток каталога и главной.
 *
 * Собираем запрошенные названия в один пакет: на сервере они уходят в
 * единственный GraphQL-запрос с несколькими поисками, поэтому целая сетка
 * карточек обходится одним обращением вместо десятков.
 *
 * Спрашиваем по ОРИГИНАЛЬНОМУ названию — русские переводы у сервисов
 * расходятся, и по ним половина тайтлов не находится.
 */

const cache = new Map<string, number>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let timer: number | null = null

export function getShikiScore(originalTitle?: string | null): number {
  if (!originalTitle) return 0
  return cache.get(originalTitle) ?? 0
}

export function subscribeShikiScores(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

async function flush(): Promise<void> {
  timer = null
  const titles = [...pending]
  pending.clear()
  if (titles.length === 0) return
  try {
    const { data } = await api.post<{ scores: Record<string, number> }>(
      '/api/v1/shikimori/scores',
      { titles },
    )
    for (const t of titles) {
      // Запоминаем и нули, иначе на каждый перерисов будем спрашивать заново
      // про тайтлы, которых на Shikimori просто нет.
      cache.set(t, Number(data?.scores?.[t]) || 0)
    }
  } catch {
    for (const t of titles) cache.set(t, 0)
  }
  for (const fn of listeners) fn()
}

/** Ставит название в очередь; запрос уходит одним пакетом на следующем тике. */
export function requestShikiScore(originalTitle?: string | null): void {
  if (!originalTitle || cache.has(originalTitle) || pending.has(originalTitle)) return
  pending.add(originalTitle)
  if (timer === null) timer = window.setTimeout(flush, 120)
}
