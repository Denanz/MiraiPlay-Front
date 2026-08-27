import { api } from './client'

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export interface AnimelibStatus {
  connected: boolean
  expiresAt: number | null
  autoRenew?: boolean
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

export async function saveAnimelibToken(
  animelibToken: string,
  animelibRefreshToken?: string,
): Promise<{ ok: boolean; expiresAt?: number; autoRenew?: boolean }> {
  try {
    const { data } = await api.post<{ ok: boolean; expiresAt?: number; autoRenew?: boolean }>(
      '/api/v1/animelib/token',
      { animelibToken, animelibRefreshToken, token: token() },
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
    // не критично, если не выйдет
  }
}

export interface AnimelibTeamsResult {
  found: boolean
  reason?: 'no_token' | 'title_not_found' | 'episode_not_found' | 'no_native_source'
  teams?: string[]
  // Настоящие номера серий AnimeLib, а не количество из Anixart: у split-cour
  // тайтлов Anixart нумерует сквозняком, а AnimeLib держит части отдельно.
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

// Ручной пин releaseId → anime_id на случай, когда поиск ошибся. Принимает и
// голый id, и ссылку на animelib.org — отправляются ведущие цифры.
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
