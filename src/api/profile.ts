import { api } from './client'

export interface AnixartProfile {
  id: number
  login: string
  avatar?: string
  status?: string
  register_date?: number
  last_activity_time?: number
  privilege_level?: number
  is_sponsor?: boolean
  sponsor_labels?: string[]
  rating_score?: number
  // Счётчики
  watching_count?: number
  plan_count?: number
  completed_count?: number
  hold_on_count?: number
  dropped_count?: number
  favorite_count?: number
  watched_episode_count?: number
  watched_time?: number
  comment_count?: number
  collection_count?: number
  video_count?: number
  friend_count?: number
  subscription_count?: number
  // Развёрнутые данные
  watch_dynamics?: WatchDynamicPoint[]
  preferred_genres?: GenreShare[]
  preferred_audiences?: GenreShare[]
  preferred_themes?: GenreShare[]
}

export interface WatchDynamicPoint {
  id: number
  day: number
  count: number
  timestamp: number
}

export interface GenreShare {
  name: string
  percentage: number
}

export async function getProfile(id: string | number): Promise<AnixartProfile | null> {
  const res = await api.get<{ code: number; profile?: AnixartProfile }>(`/api/v1/profile/${id}`)
  return res.data?.profile ?? null
}
