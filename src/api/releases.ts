import { api } from './client'

const SHIKIMORI_API = 'https://shikimori.io/api'
const SHIKIMORI_GRAPHQL = 'https://shikimori.io/api/graphql'

// Anixart returns a placeholder grade (e.g. 5.00) even for titles with zero votes,
// so `grade > 0` alone isn't enough to tell "has a real community rating" apart from
// "unrated" — vote_count must also be positive.
export function hasGrade(release: Pick<Release, 'grade' | 'vote_count'>): boolean {
  return release.grade !== undefined && release.grade > 0 && (release.vote_count ?? 0) > 0
}

export interface Release {
  id: number
  title_ru: string
  title_en?: string
  title_original?: string
  title_alt?: string
  image?: string
  grade?: number
  year?: number | string
  genres?: string
  studio?: string
  // The flat status_id field Anixart returns is always 0 (dead/unused) — the
  // real release status lives in this nested object instead.
  status_id?: number
  status?: { id: number; name: string }
  description?: string
  note?: string
  duration?: number
  profile_list_status?: number
  is_favorite?: boolean
  is_play_disabled?: boolean
  is_tpp_disabled?: boolean
  is_view_blocked?: boolean
  episodes_released?: number
  episodes_total?: number
  related_anime?: LinkedAnime[]
  // Shikimori enrichment (added by the MiraiHub gateway)
  trailer?: { url: string; image?: string | null; name?: string | null }
  watch_order?: WatchOrderNode[]
  your_vote?: number
  vote_count?: number
  // Native Anixart relations (real, clickable releases) + official frames
  related_releases?: Release[]
  recommended_releases?: Release[]
  screenshot_images?: string[]
  related?: { id: number; name?: string } | null
  related_count?: number
}

// Anixart voting (1–5). GET endpoints, like the native app.
export async function voteRelease(releaseId: number, vote: number) {
  const res = await api.get(`/api/v1/release/vote/add/${releaseId}/${vote}`)
  return res.data
}

export async function unvoteRelease(releaseId: number) {
  const res = await api.get(`/api/v1/release/vote/delete/${releaseId}`)
  return res.data
}

// Personal 1–10 rating, stored on our own server (MiraiHub) only — independent
// of Anixart's 5-star community vote. Requires a logged-in token.
export async function getMyRating(releaseId: number): Promise<number> {
  try {
    const res = await api.get<{ rating: number | null }>('/api/v1/release/rating', {
      params: { releaseId },
    })
    return res.data?.rating ?? 0
  } catch {
    return 0
  }
}

export async function setMyRating(releaseId: number, rating: number) {
  const res = await api.post('/api/v1/release/rating', { releaseId, rating })
  return res.data
}

export async function clearMyRating(releaseId: number) {
  const res = await api.delete('/api/v1/release/rating', { params: { releaseId } })
  return res.data
}

export interface LinkedAnime {
  id: string
  name: string
  russian: string
  url: string
  relationText?: string | null
  internalReleaseId?: number
  internalRelease?: Release
}

export interface WatchOrderNode {
  id: string
  name: string
  year: number | null
  kind: string | null
  url: string
  current: boolean
}

interface ShikimoriAnime {
  id: string
}

export interface ReleasesResponse {
  code: number
  content?: Release[] | { content: Release[] }
  releases?: Release[]
  release?: Release
}

// Full franchise/related list (paginated) — the inline release.related_releases
// is only a partial preview. Uses the related-group id from release.related.id.
export async function getRelatedReleases(groupId: number, maxPages = 6): Promise<Release[]> {
  const out: Release[] = []
  for (let pg = 0; pg < maxPages; pg++) {
    const res = await api.get<ReleasesResponse>(`/api/v1/related/${groupId}/${pg}`)
    const items = extractReleases(res.data)
    if (!items.length) break
    out.push(...items)
    if (items.length < 20) break
  }
  return out
}

export function extractReleases(data: ReleasesResponse): Release[] {
  if (Array.isArray(data.content)) return data.content
  if (data.content && 'content' in data.content) return data.content.content
  return data.releases || []
}

// The "more like this" list shown when a finale ends and on the release card:
// the release's own curated recommendations, topped up with same-genre releases
// (sorted by rating) when that curated list is thin (< 4 items).
export async function buildRecommendations(release: Release, limit = 18): Promise<Release[]> {
  let items: Release[] = release.recommended_releases || release.related_releases || []
  if (items.length < 4) {
    const gens = genreList(release.genres).slice(0, 2)
    if (gens.length) {
      try {
        const data = await getFilter(0, {
          genres: gens, sort: 1, page: 0,
          extended_mode: true, is_genres_exclude_mode_enabled: false,
        })
        const seen = new Set(items.map((r) => r.id))
        const fill = extractReleases(data).filter((r) => r.id !== release.id && !seen.has(r.id))
        items = [...items, ...fill] // curated first, then genre matches
      } catch { /* keep whatever curated items we have */ }
    }
  }
  return items.slice(0, limit)
}

export function genreList(genres?: string): string[] {
  if (!genres) return []
  return genres.split(',').map(g => g.trim()).filter(Boolean)
}

export function normalizeTitle(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getReleaseTitles(release: Pick<Release, 'title_ru' | 'title_en' | 'title_original' | 'title_alt'>) {
  return [release.title_ru, release.title_en, release.title_original, release.title_alt]
    .map(normalizeTitle)
    .filter(Boolean)
}

const releaseCache = new Map<string, Promise<ReleasesResponse>>()

export async function getRelease(id: string | number): Promise<ReleasesResponse> {
  const key = String(id)
  if (!releaseCache.has(key)) {
    const p = api.get<ReleasesResponse>(`/api/v1/release/${id}`, { params: { extended_mode: true } })
      .then(res => res.data)
      .catch((err) => { releaseCache.delete(key); throw err })
    releaseCache.set(key, p)
  }
  return releaseCache.get(key)!
}

export async function searchReleases(query: string, page = 0): Promise<ReleasesResponse> {
  const res = await api.post<ReleasesResponse>(`/api/v1/search/releases/${page}`, {
    query,
    searchBy: 0,
  })
  return res.data
}

export async function getFilter(page = 0, body?: Record<string, unknown>): Promise<ReleasesResponse> {
  if (body) {
    const res = await api.post<ReleasesResponse>(`/api/v1/filter/${page}`, body)
    return res.data
  }
  const res = await api.get<ReleasesResponse>(`/api/v1/filter/${page}`)
  return res.data
}

async function searchShikimoriSingle(query: string): Promise<ShikimoriAnime | null> {
  const res = await fetch(SHIKIMORI_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MiraiHub-Web/1.0',
    },
    body: JSON.stringify({
      query: `
        query($search: String) {
          animes(search: $search, limit: 1) {
            id
          }
        }
      `,
      variables: { search: query },
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const animes = data?.data?.animes
  return Array.isArray(animes) && animes.length > 0 ? animes[0] : null
}

function pickInternalRelease(anime: LinkedAnime, releases: Release[]) {
  const targetTitles = [anime.russian, anime.name].map(normalizeTitle).filter(Boolean)

  const exact = releases.find((release) => {
    const releaseTitles = getReleaseTitles(release)
    return targetTitles.some((target) => releaseTitles.includes(target))
  })
  if (exact) return exact

  return releases.find((release) => {
    const releaseTitles = getReleaseTitles(release)
    return targetTitles.some((target) => releaseTitles.some((title) => title.includes(target) || target.includes(title)))
  })
}

async function attachInternalReleaseMatches(items: LinkedAnime[]): Promise<LinkedAnime[]> {
  const cache = new Map<string, Release | null>()

  return Promise.all(items.map(async (anime) => {
    const query = anime.russian || anime.name
    if (!query) return anime

    if (!cache.has(query)) {
      try {
        const search = await searchReleases(query, 0)
        const releases = extractReleases(search)
        cache.set(query, pickInternalRelease(anime, releases) || null)
      } catch {
        cache.set(query, null)
      }
    }

    const internalRelease = cache.get(query)
    return internalRelease
      ? { ...anime, internalReleaseId: internalRelease.id, internalRelease }
      : anime
  }))
}

async function searchShikimoriLinks(
  release: Pick<Release, 'title_ru' | 'title_en' | 'title_original' | 'title_alt' | 'related_anime'>,
  endpoint: 'related' | 'similar',
): Promise<LinkedAnime[]> {
  const queries = [release.title_ru, release.title_original, release.title_en, release.title_alt]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index) as string[]

  let animeId: string | null = null
  for (const query of queries) {
    try {
      const anime = await searchShikimoriSingle(query)
      if (anime?.id) {
        animeId = anime.id
        break
      }
    } catch {
      // ignore
    }
  }

  if (!animeId) {
    return []
  }

  try {
    const res = await fetch(`${SHIKIMORI_API}/animes/${animeId}/${endpoint}`, {
      headers: {
        'User-Agent': 'MiraiHub-Web/1.0',
      },
    })

    if (!res.ok) {
      return []
    }

    const items = await res.json()
    if (!Array.isArray(items)) {
      return []
    }

    const normalized = items
      .map((item: any) => {
        const anime = endpoint === 'related' ? item?.anime : item
        if (!anime?.id || !anime?.url || !(anime?.russian || anime?.name)) {
          return null
        }

        return {
          id: String(anime.id),
          name: anime.name || anime.russian,
          russian: anime.russian || anime.name,
          url: anime.url.startsWith('http')
            ? anime.url
            : `https://shikimori.io${anime.url.startsWith('/') ? '' : '/'}${anime.url}`,
          relationText: endpoint === 'related'
            ? item?.relation_russian || item?.relation || null
            : null,
        } satisfies LinkedAnime
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return attachInternalReleaseMatches(normalized)
  } catch {
    return []
  }
}

export async function resolveReleaseRelatedAnime(
  release: Pick<Release, 'title_ru' | 'title_en' | 'title_original' | 'title_alt' | 'related_anime'>,
): Promise<LinkedAnime[]> {
  if (release.related_anime?.length) {
    return attachInternalReleaseMatches(release.related_anime)
  }

  return searchShikimoriLinks(release, 'related')
}

export async function resolveReleaseSimilarAnime(
  release: Pick<Release, 'title_ru' | 'title_en' | 'title_original' | 'title_alt'>,
): Promise<LinkedAnime[]> {
  return searchShikimoriLinks(release, 'similar')
}
