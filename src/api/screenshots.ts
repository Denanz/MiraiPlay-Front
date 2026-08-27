import { api } from './client'

const BASE = 'https://aniapi.denanz.fun:8444'

export interface ShotMeta {
  id: string
  releaseId?: string
  title?: string
  episode?: number
  time?: number
  note?: string
  createdAt: number
  ext: string
}

// Bucket — непрозрачный неугадываемый адрес, вычисляемый на сервере.
export function shotFileUrl(bucket: string, id: string): string {
  return `${BASE}/api/v1/player/screenshots/file/${bucket}/${id}`
}

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

export async function listScreenshots(): Promise<{ bucket: string; items: ShotMeta[] }> {
  const res = await api.get<{ bucket: string; items: ShotMeta[] }>(`/api/v1/player/screenshots`, {
    params: { token: token() },
  })
  return { bucket: res.data?.bucket || '', items: res.data?.items || [] }
}

export async function deleteScreenshot(id: string): Promise<void> {
  await api.delete(`/api/v1/player/screenshots/${id}`, { params: { token: token() } })
}

export async function saveScreenshotNote(id: string, note: string): Promise<void> {
  await api.post(`/api/v1/player/screenshots/${id}/note`, { note, token: token() })
}
