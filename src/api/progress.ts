import { api } from './client'

// Точная позиция просмотра, общая для устройств. История аккаунта знает только
// номер серии, а здесь есть секунда внутри неё — из неё и продолжение, и полоска
// досмотренного.
export interface ContinueItem {
  releaseId: string
  sourceId: string
  episode: string
  position: number
  duration: number
  title?: string
  updatedAt: number
}

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export async function getContinueWatching(): Promise<ContinueItem[]> {
  if (!token()) return []
  try {
    const res = await api.get<{ items?: ContinueItem[] }>('/api/v1/player/continue')
    return res.data?.items || []
  } catch {
    return []
  }
}

// Процент досмотренного внутри серии. Ноль, если длительность неизвестна.
export function watchedPct(position: number, duration: number): number {
  if (!duration || duration <= 0) return 0
  return Math.min(100, Math.max(0, (position / duration) * 100))
}

// "12:34" / "1:02:03"
export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return (h ? `${h}:` : '') + `${mm}:${String(r).padStart(2, '0')}`
}
