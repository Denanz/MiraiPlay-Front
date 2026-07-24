import { api } from './client'

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export interface AnimelibStatus {
  connected: boolean
  expiresAt: number | null
}

export async function getAnimelibStatus(): Promise<AnimelibStatus> {
  if (!token()) return { connected: false, expiresAt: null }
  try {
    const { data } = await api.get<AnimelibStatus>('/api/v1/animelib/status', { params: { token: token() } })
    return data ?? { connected: false, expiresAt: null }
  } catch {
    return { connected: false, expiresAt: null }
  }
}

export async function saveAnimelibToken(animelibToken: string): Promise<{ ok: boolean; expiresAt?: number }> {
  try {
    const { data } = await api.post<{ ok: boolean; expiresAt?: number }>(
      '/api/v1/animelib/token',
      { animelibToken, token: token() },
    )
    return data ?? { ok: false }
  } catch {
    return { ok: false }
  }
}

export async function disconnectAnimelib(): Promise<void> {
  try {
    await api.post('/api/v1/animelib/disconnect', { token: token() })
  } catch {
    // best-effort
  }
}

export interface AnimelibTeamsResult {
  found: boolean
  reason?: 'no_token' | 'title_not_found' | 'episode_not_found' | 'no_native_source'
  teams?: string[]
  // AnimeLib's own real episode numbers — not Anixart's episode count. A
  // split-cour title can have Anixart running continuous numbering while
  // AnimeLib carries each part as a separate title starting over at 1.
  episodeNumbers?: string[]
}

export async function getAnimelibTeams(
  releaseId: string,
  titles: { orig?: string; ru?: string; en?: string },
): Promise<AnimelibTeamsResult> {
  if (!token()) return { found: false, reason: 'no_token' }
  try {
    const { data } = await api.get<AnimelibTeamsResult>('/api/v1/animelib/teams', {
      params: {
        token: token(),
        releaseId,
        titleOrig: titles.orig || '',
        titleRu: titles.ru || '',
        titleEn: titles.en || '',
      },
    })
    return data ?? { found: false }
  } catch {
    return { found: false }
  }
}

// Manual releaseId -> AnimeLib anime_id pin — fallback for whatever the
// (authenticated) search on the backend still gets wrong. Accepts either a
// bare id or a pasted animelib.org URL/slug (e.g. "24321--tensei-..."); the
// leading digits are what gets sent.
export async function setAnimelibOverride(releaseId: string, animeIdOrUrl: string): Promise<boolean> {
  const match = animeIdOrUrl.match(/(\d+)/)
  const animeId = match ? Number(match[1]) : NaN
  if (!animeId) return false
  try {
    const { data } = await api.post<{ ok: boolean }>('/api/v1/animelib/override', {
      releaseId, animeId, token: token(),
    })
    return !!data?.ok
  } catch {
    return false
  }
}
