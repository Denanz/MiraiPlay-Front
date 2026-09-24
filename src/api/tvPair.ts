import { api } from './client'

/** Вход на телевизоре по коду: ТВ заводит заявку, телефон её подтверждает. */

export interface TvPairStart {
  code: string
  secret: string
  expiresIn: number
}

export type TvPairPoll =
  | { status: 'pending' | 'expired' }
  | { status: 'ok'; token: string; userId: number; login: string }

export async function startTvPair(): Promise<TvPairStart> {
  const { data } = await api.post<TvPairStart>('/api/v1/auth/tv/start')
  return data
}

export async function pollTvPair(secret: string): Promise<TvPairPoll> {
  const { data } = await api.get<TvPairPoll>('/api/v1/auth/tv/poll', { params: { secret } })
  return data
}

/** С телефона: отдать свою сессию телевизору с этим кодом. Токен подставит interceptor. */
export async function approveTvPair(code: string): Promise<void> {
  await api.post('/api/v1/auth/tv/approve', { code })
}

/** Страница подтверждения в веб-версии — на неё ведёт QR-код с телевизора. */
export const TV_LINK_URL = 'https://anime.denanz.fun/tv'
