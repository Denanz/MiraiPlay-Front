import { api } from './client'

export interface StorageBreakdown {
  breakdown: {
    screenshots: { bytes: number; buckets: number }
    progress: { bytes: number }
    ratings: { bytes: number }
    diary: { bytes: number }
    cache: { bytes: number }
    other: { bytes: number }
  }
  totalBytes: number
}

export async function getStorageBreakdown(adminKey: string): Promise<StorageBreakdown> {
  const res = await api.get<StorageBreakdown>('/api/v1/admin/storage', {
    headers: { 'X-Admin-Key': adminKey },
  })
  return res.data
}

// Public — no admin key needed. The Home page hero calls this on every visit.
export async function getSpotlightOverride(): Promise<string | null> {
  const res = await api.get<{ releaseId: string | null }>('/api/v1/spotlight')
  return res.data?.releaseId ?? null
}

export async function setSpotlightOverride(adminKey: string, releaseId: string | null): Promise<void> {
  await api.post('/api/v1/admin/spotlight', { releaseId }, {
    headers: { 'X-Admin-Key': adminKey },
  })
}

export interface ActiveSession {
  id: number
  login: string
  ip: string
  openedAt: number
  seenAt: number
  hits: number
}

export interface LoginRecord {
  at: number
  id: number
  login: string
  ip: string
  agent: string
}

export interface Telemetry {
  overview: {
    uptimeMs: number
    totalRequests: number
    lastHour: number
    sessionsSeen: number
    active: ActiveSession[]
    topIps: Array<[string, number]>
  }
  recentLogins: LoginRecord[]
  denylist: { ips: string[]; accounts: number[]; logins: string[] }
}

export async function getTelemetry(adminKey: string): Promise<Telemetry> {
  const res = await api.get<Telemetry>('/api/v1/admin/telemetry', {
    headers: { 'X-Admin-Key': adminKey },
  })
  return res.data
}

export async function banIp(adminKey: string, ip: string): Promise<void> {
  await api.post('/api/v1/admin/denylist/ip', { ip, action: 'ban' }, { headers: { 'X-Admin-Key': adminKey } })
}

export async function unbanIp(adminKey: string, ip: string): Promise<void> {
  await api.post('/api/v1/admin/denylist/ip', { ip, action: 'unban' }, { headers: { 'X-Admin-Key': adminKey } })
}

export async function banUser(adminKey: string, value: string): Promise<void> {
  await api.post('/api/v1/admin/denylist/user', { value, action: 'ban' }, { headers: { 'X-Admin-Key': adminKey } })
}

export async function unbanUser(adminKey: string, value: string): Promise<void> {
  await api.post('/api/v1/admin/denylist/user', { value, action: 'unban' }, { headers: { 'X-Admin-Key': adminKey } })
}

// Приватный APK хаба — не раздаётся публично, только за ADMIN_KEY.
export async function downloadHubApk(adminKey: string): Promise<void> {
  const res = await api.get('/api/v1/admin/hub-apk', {
    headers: { 'X-Admin-Key': adminKey },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mirai-hub.apk'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
