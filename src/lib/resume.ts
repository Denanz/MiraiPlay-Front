import type { NavigateFunction } from 'react-router-dom'
import { getEpisodeTarget, saveWatchProgress, type WatchProgressEntry } from '../api/episodes'
import { isPlayableUrl } from './playableHost'

// Достаём поток сохранённой серии и уходим сразу в плеер. Если ссылку получить
// не вышло, показываем экран выбора серии.
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
    if (!isPlayableUrl(kodikUrl)) {
      navigate(`/watch/${releaseId}`)
      return
    }
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
        // Без typeId панель серий не может получить их названия. Записи из
        // истории аккаунта его не содержат — там страхует резолв по sourceId.
        typeId: entry.typeId,
      },
    })
  } catch {
    navigate(`/watch/${releaseId}`)
  }
}
