import { getProfileList, setListStatus } from './bookmarks'

// Anixart profile list ids
export const LIST_NAMES: Record<number, string> = {
  1: 'Смотрю', 2: 'В планах', 3: 'Просмотрено', 4: 'Отложено', 5: 'Брошено',
}

export interface BackupItem { releaseId: number; title: string; listId: number }

export async function exportLists(onProgress?: (s: string) => void): Promise<BackupItem[]> {
  const out: BackupItem[] = []
  for (const listId of [1, 2, 3, 4, 5]) {
    for (let pg = 0; pg < 80; pg++) {
      const data = await getProfileList(listId, pg)
      const arr = data?.content || []
      if (!arr.length) break
      for (const it of arr) {
        const id = it.release?.id ?? it.id
        const title = it.release?.title_ru ?? it.title_ru ?? ''
        if (id) out.push({ releaseId: id, title, listId })
      }
      onProgress?.(`${LIST_NAMES[listId]}: собрано ${out.length}`)
      if (arr.length < 20) break
    }
  }
  return out
}

export async function importLists(items: BackupItem[], onProgress?: (done: number, total: number) => void): Promise<number> {
  // setListStatus needs each release's REAL current list to remove it before
  // adding the new one — hardcoding 0 (no prior list) skips that delete step,
  // so a release already in a different list ends up belonging to two lists
  // at once instead of being moved. Look up the account's actual current
  // membership first.
  const currentStatus = new Map<number, number>()
  for (const listId of [1, 2, 3, 4, 5]) {
    for (let pg = 0; pg < 80; pg++) {
      const data = await getProfileList(listId, pg).catch(() => null)
      const arr = data?.content || []
      if (!arr.length) break
      for (const it of arr) {
        const id = it.release?.id ?? it.id
        if (id) currentStatus.set(id, listId)
      }
      if (arr.length < 20) break
    }
  }

  let done = 0, ok = 0
  for (const it of items) {
    if (it.releaseId && LIST_NAMES[it.listId]) {
      try { await setListStatus(it.releaseId, it.listId, currentStatus.get(it.releaseId) || 0); ok++ } catch { /* ignore */ }
    }
    done++
    onProgress?.(done, items.length)
  }
  return ok
}

export function toCsv(items: BackupItem[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  return ['releaseId,list,title', ...items.map(i => `${i.releaseId},${esc(LIST_NAMES[i.listId] || '')},${esc(i.title)}`)].join('\n')
}

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
