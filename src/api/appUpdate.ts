import { api } from './client'

export interface AppVersion {
  versionCode: number
  versionName: string
  url: string
  notes: string
  mandatory: boolean
}

// Latest published app version, advertised by the MiraiHub backend. Returns null
// on any failure so the update check can never block or break app startup.
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
