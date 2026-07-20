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

/** Ник на Shikimori либо причина отказа — её нужно показать пользователю. */
export async function connectShikimori(code: string): Promise<{ nickname?: string; error?: string }> {
  try {
    const { data } = await api.post<{ nickname: string }>('/api/v1/shikimori/connect', { code, token: token() })
    return { nickname: data?.nickname }
  } catch (e) {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return { error: detail || 'сервер не принял код' }
  }
}

export async function disconnectShikimori(): Promise<void> {
  try {
    await api.post('/api/v1/shikimori/disconnect', { token: token() })
  } catch { /* уже отключено — не страшно */ }
}

export interface ShikiProfileDigest {
  nickname: string
  url: string
  avatar: string
  lastOnline: string
  about: string[]
  statuses: Array<{ name: string; size: number }>
  scores: Array<{ score: number; count: number }>
  types: Array<{ name: string; count: number }>
}

/** null — Shikimori не подключён либо не ответил. */
export async function getShikiProfile(): Promise<ShikiProfileDigest | null> {
  if (!token()) return null
  try {
    const { data } = await api.get<{ profile: ShikiProfileDigest }>('/api/v1/shikimori/profile', {
      params: { token: token() },
    })
    return data?.profile ?? null
  } catch {
    return null
  }
}

export interface MigrateReport {
  total: number
  matched: number
  written: number
  unmatched: string[]
  failed: string[]
}

export interface MigrateJob {
  running: boolean
  dryRun: boolean
  done: number
  total: number
  report?: MigrateReport
  error?: string
}

/** Ссылка на выгрузку — открывается как обычное скачивание. */
export function shikiBackupUrl(): string {
  return `${api.defaults.baseURL ?? ''}/api/v1/shikimori/backup?token=${encodeURIComponent(token())}`
}

export async function getMigrateStatus(): Promise<MigrateJob | null> {
  if (!token()) return null
  try {
    const { data } = await api.get<{ job: MigrateJob | null }>('/api/v1/shikimori/migrate/status', {
      params: { token: token() },
    })
    return data?.job ?? null
  } catch {
    return null
  }
}

/** false — прогон уже идёт. */
export async function startMigrate(dryRun: boolean): Promise<boolean> {
  try {
    await api.post('/api/v1/shikimori/migrate', { dryRun, token: token() })
    return true
  } catch {
    return false
  }
}

export interface ImportCandidate {
  shikiName: string
  status: string
  score: number
  releaseTitle?: string
  reason?: string
}

export interface ImportReport {
  total: number
  matched: number
  applied: number
  skipped: ImportCandidate[]
  failed: string[]
}

export interface ImportJob {
  running: boolean
  dryRun: boolean
  done: number
  total: number
  report?: ImportReport
}

export async function getImportStatus(): Promise<ImportJob | null> {
  if (!token()) return null
  try {
    const { data } = await api.get<{ job: ImportJob | null }>('/api/v1/shikimori/import/status', {
      params: { token: token() },
    })
    return data?.job ?? null
  } catch {
    return null
  }
}

export async function startImport(dryRun: boolean): Promise<boolean> {
  try {
    await api.post('/api/v1/shikimori/import', { dryRun, token: token() })
    return true
  } catch {
    return false
  }
}
