import { api } from './client'

const WATCH_PROGRESS_KEY = 'miraihub_watch_progress'
const WATCH_SELECTION_KEY = 'miraihub_watch_selection'

// Разовый перенос со старых ключей, чтобы не потерять локальный прогресс.
try {
  for (const [oldK, newK] of [
    ['anixartex_watch_progress', WATCH_PROGRESS_KEY],
    ['anixartex_watch_selection', WATCH_SELECTION_KEY],
  ] as const) {
    const v = localStorage.getItem(oldK)
    if (v && !localStorage.getItem(newK)) localStorage.setItem(newK, v)
    if (v) localStorage.removeItem(oldK)
  }
} catch { /* ignore */ }

export interface EpisodeType {
  id: number
  name: string
  icon?: string
  is_sub?: boolean
  episodes_count?: number
}

export interface EpisodeSource {
  id: number
  name: string
  episodes_count?: number
  type?: EpisodeType
}

export interface Episode {
  id?: number
  position: number
  name?: string
  url?: string
  iframe?: string
  is_watched?: boolean
  is_filler?: boolean
}

export interface WatchProgressEntry {
  releaseId: string
  releaseTitle?: string
  releaseImage?: string
  typeId?: number
  typeName?: string
  sourceId?: number
  sourceName?: string
  episodePosition: number
  episodeName?: string
  updatedAt: number
  episodesTotal?: number
  episodesReleased?: number
}

// Кэш в памяти на время сессии: переходы вперёд-назад становятся мгновенными.
// Очищается полной перезагрузкой страницы.
const memCache = new Map<string, Promise<unknown>>()
function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (!memCache.has(key)) {
    const p = loader().catch((err) => { memCache.delete(key); throw err })
    memCache.set(key, p)
  }
  return memCache.get(key) as Promise<T>
}

export async function getDubbers(releaseId: string | number) {
  return cached(`dub:${releaseId}`, async () => {
    const res = await api.get<{ code: number; types?: EpisodeType[] }>(`/api/v1/episode/${releaseId}`)
    return res.data
  })
}

export async function getSources(releaseId: string | number, typeId: number) {
  return cached(`src:${releaseId}:${typeId}`, async () => {
    const res = await api.get<{ code: number; sources?: EpisodeSource[] }>(`/api/v1/episode/${releaseId}/${typeId}`)
    return res.data
  })
}

/** Сбросить кеш списка серий — нужен после ручной отметки просмотра, иначе
 *  повторное открытие панели покажет старое значение is_watched. */
export function invalidateEpisodes(releaseId: string | number, typeId: number, sourceId: number) {
  memCache.delete(`eps:${releaseId}:${typeId}:${sourceId}`)
}

export async function getEpisodes(releaseId: string | number, typeId: number, sourceId: number) {
  return cached(`eps:${releaseId}:${typeId}:${sourceId}`, async () => {
    const res = await api.get<{ code: number; episodes?: Episode[] }>(`/api/v1/episode/${releaseId}/${typeId}/${sourceId}`)
    return res.data
  })
}

export async function getEpisodeTarget(releaseId: string | number, sourceId: number, position: number) {
  const res = await api.get<{ code: number; episode?: Episode }>(`/api/v1/episode/target/${releaseId}/${sourceId}/${position}`)
  return res.data
}

export async function markWatched(releaseId: string | number, sourceId: number, position: number) {
  const res = await api.get(`/api/v1/episode/watch/${releaseId}/${sourceId}/${position}`)
  return res.data
}

/** Снять отметку просмотра. Парная к markWatched — обе отражаются в is_watched. */
export async function unmarkWatched(releaseId: string | number, sourceId: number, position: number) {
  const res = await api.get(`/api/v1/episode/unwatch/${releaseId}/${sourceId}/${position}`)
  return res.data
}

export async function addHistory(releaseId: string | number, sourceId: number, position: number) {
  const res = await api.get(`/api/v1/history/add/${releaseId}/${sourceId}/${position}`)
  return res.data
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getWatchProgressMap() {
  return readJson<Record<string, WatchProgressEntry>>(WATCH_PROGRESS_KEY, {})
}

export function getWatchProgress(releaseId: string | number) {
  const key = String(releaseId)
  return getWatchProgressMap()[key] || null
}

export function saveWatchProgress(entry: WatchProgressEntry) {
  const map = getWatchProgressMap()
  const key = String(entry.releaseId)
  // Сохраняем постер при обновлениях, которые его не несут.
  const prev = map[key]
  map[key] = { ...entry, releaseImage: entry.releaseImage || prev?.releaseImage }
  writeJson(WATCH_PROGRESS_KEY, map)
}

export function removeWatchProgress(releaseId: string | number) {
  const map = getWatchProgressMap()
  delete map[String(releaseId)]
  writeJson(WATCH_PROGRESS_KEY, map)
}

export function listWatchProgress(): WatchProgressEntry[] {
  return Object.values(getWatchProgressMap()).sort((a, b) => b.updatedAt - a.updatedAt)
}

// «Продолжить смотреть» из истории аккаунта, общей для устройств. Элемент истории —
// это релиз, а последняя серия лежит в `last_view_episode`. Список свежими вперёд.
interface LastViewEpisode {
  releaseId?: number
  sourceId?: number
  position?: number
  name?: string
  source?: { name?: string; type?: { name?: string } }
}
interface HistoryReleaseItem {
  id?: number
  title_ru?: string
  image?: string
  episodes_total?: number
  episodes_released?: number
  last_view_episode?: LastViewEpisode | null
}

export async function deleteAccountHistory(releaseId: string | number) {
  await api.get(`/api/v1/history/delete/${releaseId}`)
}

export interface WatchedRelease { releaseId: string; title: string; position: number }

// Вся история просмотра постранично — самая дальняя серия по каждому тайтлу.
// Нужна для ачивок, привязанных к конкретным тайтлам.
export async function getWatchedReleases(maxPages = 12): Promise<WatchedRelease[]> {
  const best = new Map<string, WatchedRelease>()
  for (let pg = 0; pg < maxPages; pg++) {
    let items: HistoryReleaseItem[] = []
    try {
      const res = await api.get<{ content?: HistoryReleaseItem[] }>(`/api/v1/history/${pg}`)
      items = res.data?.content || []
    } catch { break }
    if (!items.length) break
    for (const it of items) {
      const lve = it.last_view_episode
      const id = String(lve?.releaseId ?? it.id ?? '')
      if (!id) continue
      const pos = Number(lve?.position) || 0
      const prev = best.get(id)
      if (!prev || pos > prev.position) best.set(id, { releaseId: id, title: it.title_ru || '', position: pos })
    }
    if (items.length < 20) break
  }
  return [...best.values()]
}

export async function getAccountContinueWatching(): Promise<WatchProgressEntry[]> {
  const res = await api.get<{ content?: HistoryReleaseItem[] }>(`/api/v1/history/0`)
  const items = res.data?.content || []
  const now = Date.now()
  return items
    .map((it, idx) => ({ it, lve: it.last_view_episode, idx }))
    .filter((x): x is { it: HistoryReleaseItem; lve: LastViewEpisode; idx: number } =>
      !!x.lve && !!x.lve.sourceId && !!x.lve.position)
    .map(({ it, lve, idx }) => ({
      releaseId: String(lve.releaseId ?? it.id),
      releaseTitle: it.title_ru,
      releaseImage: it.image,
      sourceId: lve.sourceId,
      sourceName: lve.source?.name,
      typeName: lve.source?.type?.name,
      episodePosition: lve.position as number,
      episodeName: lve.name,
      updatedAt: now - idx, // preserve server ordering (newest-first)
      episodesTotal: it.episodes_total,
      episodesReleased: it.episodes_released,
    }))
}

// Короткий кэш, чтобы несколько запросов в одном рендере не тянули историю заново.
let accountContinueCache: { at: number; data: WatchProgressEntry[] } | null = null
async function accountContinueCached(): Promise<WatchProgressEntry[]> {
  if (accountContinueCache && Date.now() - accountContinueCache.at < 30_000) return accountContinueCache.data
  const data = await getAccountContinueWatching()
  accountContinueCache = { at: Date.now(), data }
  return data
}

/**
 * «На чём остановился» по одному релизу. Истина — история аккаунта, она
 * обновляется на сервере при каждом запуске; localStorage лишь кэш устройства.
 * Возвращаем то, что дальше, чтобы продолжение работало одинаково везде.
 */
export async function getReleaseProgress(releaseId: string | number): Promise<WatchProgressEntry | null> {
  const key = String(releaseId)
  const local = getWatchProgress(key)
  let remote: WatchProgressEntry | null = null
  if (localStorage.getItem('anixart_token')) {
    try {
      remote = (await accountContinueCached()).find((e) => e.releaseId === key) || null
    } catch { /* ignore */ }
  }
  if (remote && local) return local.episodePosition > remote.episodePosition ? local : remote
  return remote || local
}

export function getWatchSelection(releaseId: string | number) {
  const key = String(releaseId)
  return readJson<Record<string, { typeId?: number; sourceId?: number }>>(WATCH_SELECTION_KEY, {})[key] || null
}

export function saveWatchSelection(
  releaseId: string | number,
  value: { typeId?: number; sourceId?: number },
) {
  const key = String(releaseId)
  const map = readJson<Record<string, { typeId?: number; sourceId?: number }>>(WATCH_SELECTION_KEY, {})
  map[key] = value
  writeJson(WATCH_SELECTION_KEY, map)
}
