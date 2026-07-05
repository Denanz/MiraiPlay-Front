import { api } from './client'

export interface DiaryEntry {
  text: string
  rating: number // 0 = unset, else 1–10
  updatedAt: number
}

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export async function getDiary(releaseId: string | number): Promise<DiaryEntry | null> {
  if (!token()) return null
  try {
    const { data } = await api.get<{ entry: DiaryEntry | null }>('/api/v1/diary', {
      params: { releaseId, token: token() },
    })
    return data?.entry ?? null
  } catch {
    return null
  }
}

export async function saveDiary(releaseId: string | number, text: string, rating: number): Promise<void> {
  if (!token()) return
  await api.post('/api/v1/diary', { releaseId, text, rating, token: token() })
}
