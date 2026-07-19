import { api } from './client'

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

// Stable account id — anchors this user's subscriber so notifications track
// their own watch lists (and their own Telegram), not whoever configured last.
function profileId(): string {
  return localStorage.getItem('anixart_user_id') || ''
}

export async function getNotifyChat(): Promise<string> {
  if (!token()) return ''
  try {
    const { data } = await api.get<{ chatId: string }>('/api/v1/notify/chat', {
      params: { token: token(), profileId: profileId() },
    })
    return data?.chatId || ''
  } catch {
    return ''
  }
}

// Returns { delivered } — whether the bot could actually message the chat
// (false usually means the user hasn't pressed /start in the bot yet).
export async function saveNotifyChat(chatId: string): Promise<{ delivered: boolean }> {
  const { data } = await api.post<{ ok: boolean; delivered: boolean }>('/api/v1/notify/chat', {
    chatId, token: token(), profileId: profileId(),
  })
  return { delivered: !!data?.delivered }
}

/** Тайтлы, по которым пользователь ждёт полного выхода сезона. */
export async function getAwaitFull(): Promise<string[]> {
  if (!token()) return []
  try {
    const { data } = await api.get<{ releases: string[] }>('/api/v1/notify/await-full', {
      params: { token: token() },
    })
    return data?.releases ?? []
  } catch {
    return []
  }
}

/** true — получилось; false означает, что Telegram ещё не привязан. */
export async function setAwaitFull(releaseId: string | number, on: boolean): Promise<boolean> {
  if (!token()) return false
  try {
    await api.post('/api/v1/notify/await-full', { releaseId, on, token: token() })
    return true
  } catch {
    return false
  }
}

// ── Shikimori ──
export interface ShikiStatus {
  configured: boolean
  connected: boolean
  nickname?: string
  authorizeUrl?: string
}

export async function getShikiStatus(): Promise<ShikiStatus> {
  if (!token()) return { configured: false, connected: false }
  try {
    const { data } = await api.get<ShikiStatus>('/api/v1/shikimori/status', { params: { token: token() } })
    return data ?? { configured: false, connected: false }
  } catch {
    return { configured: false, connected: false }
  }
}

/** Возвращает ник на Shikimori или null, если код не подошёл. */
export async function connectShikimori(code: string): Promise<string | null> {
  try {
    const { data } = await api.post<{ nickname: string }>('/api/v1/shikimori/connect', { code, token: token() })
    return data?.nickname ?? null
  } catch {
    return null
  }
}

export async function disconnectShikimori(): Promise<void> {
  try {
    await api.post('/api/v1/shikimori/disconnect', { token: token() })
  } catch { /* уже отключено — не страшно */ }
}
