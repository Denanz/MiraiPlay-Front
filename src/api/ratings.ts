import { api } from './client'

export async function getEpisodeRatings(
  releaseId: string,
  sourceId: number,
): Promise<Record<string, number>> {
  const token = localStorage.getItem('anixart_token')
  if (!token) return {}
  const { data } = await api.get<{ ratings: Record<string, number> }>('/api/v1/player/ratings', {
    params: { releaseId, sourceId, token },
  })
  return data.ratings ?? {}
}

export async function saveEpisodeRating(
  releaseId: string,
  sourceId: number,
  episode: number,
  rating: number,
): Promise<void> {
  const token = localStorage.getItem('anixart_token')
  if (!token) return
  await api.post('/api/v1/player/rating', { releaseId, sourceId, episode, rating, token })
}
