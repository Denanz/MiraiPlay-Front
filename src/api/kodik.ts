import { api } from './client'

export interface KodikQuality {
  label: string
  url: string
}

export interface KodikPlayback {
  qualities: KodikQuality[]
  defaultLabel: string
}

export async function resolveKodik(url: string): Promise<KodikPlayback> {
  const kodikUrl = url.startsWith('//') ? `https:${url}` : url
  const res = await api.get<KodikPlayback>('/api/v1/kodik/resolve', {
    params: { url: kodikUrl },
  })
  return res.data
}
