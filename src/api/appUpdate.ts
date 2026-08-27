import { api } from './client'

export interface AppVersion {
  versionCode: number
  versionName: string
  url: string
  notes: string
  mandatory: boolean
}

// Последняя опубликованная версия приложения. При любой ошибке возвращает null,
// чтобы проверка обновлений не мешала запуску.
export async function getLatestVersion(): Promise<AppVersion | null> {
  try {
    const res = await api.get<AppVersion>('/api/v1/app/version')
    const v = res.data
    if (v && typeof v.versionCode === 'number') return v
    return null
  } catch {
    return null
  }
}
