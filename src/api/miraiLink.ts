import { api } from './client'

/**
 * Связка с аккаунтом Mirai. Кука `mirai_session` выдана на `.denanz.fun`, а API
 * живёт на другом поддомене, поэтому этим запросам нужен `withCredentials` —
 * без него браузер куку не приложит и связка не найдётся. В APK куки домена
 * нет вовсе (origin `capacitor://localhost`), там всё это тихо отвечает
 * «недоступно», и вход остаётся по Anixart.
 */
const withCookies = { withCredentials: true }

export interface MiraiLinkStatus {
  available: boolean
  linked: boolean
  login: string | null
  linkedAt: number | null
}

export interface MiraiSession {
  token: string
  userId: number
  login: string
}

export async function getMiraiLinkStatus(): Promise<MiraiLinkStatus> {
  try {
    const { data } = await api.get<MiraiLinkStatus>('/api/v1/auth/mirai/status', withCookies)
    return data ?? { available: false, linked: false, login: null, linkedAt: null }
  } catch {
    return { available: false, linked: false, login: null, linkedAt: null }
  }
}

/** Сохранённая сессия Anixart для предъявителя куки Mirai — или null. */
export async function fetchMiraiSession(): Promise<MiraiSession | null> {
  try {
    const { data } = await api.get<MiraiSession>('/api/v1/auth/mirai/session', withCookies)
    return data?.token ? data : null
  } catch {
    return null
  }
}

export async function linkMirai(): Promise<{ ok: boolean; login?: string }> {
  try {
    const { data } = await api.post<{ ok: boolean; login?: string }>(
      '/api/v1/auth/mirai/link', {}, withCookies,
    )
    return data ?? { ok: false }
  } catch {
    return { ok: false }
  }
}

export async function unlinkMirai(): Promise<void> {
  try {
    await api.post('/api/v1/auth/mirai/unlink', {}, withCookies)
  } catch {
    // не критично, если не выйдет
  }
}
