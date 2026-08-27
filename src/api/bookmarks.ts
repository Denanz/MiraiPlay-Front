import { api } from './client'
import type { Release } from './releases'

export interface BookmarkItem {
  release?: Release
  id?: number
  title_ru?: string
}

export function extractBookmarkRelease(item: BookmarkItem): Release | null {
  if (item.release) return item.release
  if (item.id && item.title_ru) return item as Release
  return null
}

export async function getHistory(page = 0) {
  const res = await api.get<{ code: number; content?: BookmarkItem[] }>(`/api/v1/history/${page}`)
  return res.data
}

export async function getFavorites(page = 0) {
  const res = await api.get<{ code: number; content?: BookmarkItem[] }>(`/api/v1/favorite/all/${page}`)
  return res.data
}

export async function getProfileList(listId: number, page = 0) {
  const res = await api.get<{ code: number; content?: BookmarkItem[] }>(`/api/v1/profile/list/all/${listId}/${page}`)
  return res.data
}

// В API Anixart добавление и удаление — отдельные GET-ручки, а не переключатель.
export async function toggleFavorite(releaseId: number, isFavorite: boolean) {
  const action = isFavorite ? 'delete' : 'add'
  const res = await api.get(`/api/v1/favorite/${action}/${releaseId}`)
  return res.data
}

// Смена списка в профиле: сначала убираем из прежнего, потом кладём в новый.
// Повторный клик по текущему списку убирает тайтл из него.
export async function setListStatus(releaseId: number, listId: number, currentStatus: number) {
  if (currentStatus === listId) {
    const res = await api.get(`/api/v1/profile/list/delete/${listId}/${releaseId}`)
    return res.data
  }
  if (currentStatus && currentStatus > 0) {
    await api.get(`/api/v1/profile/list/delete/${currentStatus}/${releaseId}`)
  }
  const res = await api.get(`/api/v1/profile/list/add/${listId}/${releaseId}`)
  return res.data
}
