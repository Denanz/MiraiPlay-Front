import { api } from '../api/client'

interface HistoryRelease {
  id?: number
  title_ru?: string
  image?: string
  genres?: string
  year?: string
  country?: string
  studio?: string
  grade?: number
  status?: { name?: string }
  last_view_episode?: { position?: number } | null
}

export interface Tally { name: string; count: number }

export interface WrappedStats {
  totalReleases: number
  totalWatchedReleases: number
  genres: Tally[]
  countries: Tally[]
  studios: Tally[]
  decades: Tally[]
  topRated: HistoryRelease[]
  longestBinge: HistoryRelease | null // release with the highest last-watched position
}

function bump(map: Map<string, number>, key?: string) {
  const k = (key || '').trim()
  if (!k) return
  map.set(k, (map.get(k) || 0) + 1)
}

function topTally(map: Map<string, number>, limit = 8): Tally[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// Pull the full account history (paginated) and aggregate all-time taste data.
export async function computeWrapped(maxPages = 30): Promise<WrappedStats> {
  const all: HistoryRelease[] = []
  for (let page = 0; page < maxPages; page++) {
    const res = await api.get<{ content?: HistoryRelease[] }>(`/api/v1/history/${page}`)
    const items = res.data?.content || []
    all.push(...items)
    if (items.length < 20) break // last page
  }

  const genres = new Map<string, number>()
  const countries = new Map<string, number>()
  const studios = new Map<string, number>()
  const decades = new Map<string, number>()

  for (const r of all) {
    ;(r.genres || '').split(',').forEach((g) => bump(genres, g))
    bump(countries, r.country)
    bump(studios, r.studio)
    const y = parseInt(r.year || '', 10)
    if (Number.isFinite(y) && y > 1950) bump(decades, `${Math.floor(y / 10) * 10}-е`)
  }

  const watched = all.filter((r) => r.last_view_episode && r.last_view_episode.position)
  const topRated = [...all]
    .filter((r) => (r.grade ?? 0) > 0)
    .sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0))
    .slice(0, 5)
  const longestBinge = watched
    .slice()
    .sort((a, b) => (b.last_view_episode?.position ?? 0) - (a.last_view_episode?.position ?? 0))[0] || null

  return {
    totalReleases: all.length,
    totalWatchedReleases: watched.length,
    genres: topTally(genres),
    countries: topTally(countries, 5),
    studios: topTally(studios, 8),
    decades: topTally(decades, 8),
    topRated,
    longestBinge,
  }
}
