import type { NavigateFunction } from 'react-router-dom'
import { getEpisodeTarget, saveWatchProgress, type WatchProgressEntry } from '../api/episodes'

// Resolve the saved episode's stream and jump straight into the player.
// Falls back to the episode-selection screen if the link can't be obtained.
export async function resumeWatch(navigate: NavigateFunction, entry: WatchProgressEntry) {
  const releaseId = String(entry.releaseId)
  if (!entry.sourceId) {
    navigate(`/watch/${releaseId}`)
    return
  }
  try {
    const data = await getEpisodeTarget(releaseId, entry.sourceId, entry.episodePosition)
    const rawUrl = data.episode?.url || ''
    if (!rawUrl) {
      navigate(`/watch/${releaseId}`)
      return
    }
    const kodikUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
    saveWatchProgress({ ...entry, updatedAt: Date.now() })
    navigate('/player', {
      state: {
        kodikUrl,
        releaseId,
        sourceId: entry.sourceId,
        position: entry.episodePosition,
        episodeName: entry.episodeName || `Эпизод ${entry.episodePosition}`,
        releaseName: entry.releaseTitle,
        dubberName: entry.typeName,
        sourceName: entry.sourceName,
      },
    })
  } catch {
    navigate(`/watch/${releaseId}`)
  }
}
