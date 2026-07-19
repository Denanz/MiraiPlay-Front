import { api } from './client'

export interface DiaryEntry {
  text: string
  rating: number // 0 = unset, else 1–10
  updatedAt: number
  title?: string
  image?: string
}

/** Запись вместе с id тайтла — в хранилище id это ключ, а не поле. */
export interface DiaryListItem extends DiaryEntry {
  releaseId: string
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

/** meta сохраняется вместе с записью, чтобы лента не тянула название и постер
 *  отдельным запросом на каждый тайтл. */
export async function saveDiary(
  releaseId: string | number,
  text: string,
  rating: number,
  meta?: { title?: string; image?: string },
): Promise<void> {
  if (!token()) return
  await api.post('/api/v1/diary', { releaseId, text, rating, ...meta, token: token() })
}

export async function listDiary(): Promise<DiaryListItem[]> {
  if (!token()) return []
  try {
    const { data } = await api.get<{ entries: DiaryListItem[] }>('/api/v1/diary/all', {
      params: { token: token() },
    })
    return data?.entries ?? []
  } catch {
    return []
  }
}
