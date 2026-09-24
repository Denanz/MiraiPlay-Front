import { useEffect, useState } from 'react'
import { getFavorites, getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import type { Release } from '../api/releases'
import TvBrowse, { type BrowseItem, type BrowseRow } from './TvBrowse'

// Те же списки, что на вебе в «Закладках»: избранное и списки профиля Anixart.
const LISTS: Array<{ id: string; title: string; load: () => ReturnType<typeof getFavorites> }> = [
  { id: 'watching', title: 'Смотрю', load: () => getProfileList(1, 0) },
  { id: 'fav', title: 'Избранное', load: () => getFavorites(0) },
  { id: 'plan', title: 'В планах', load: () => getProfileList(2, 0) },
  { id: 'done', title: 'Просмотрено', load: () => getProfileList(3, 0) },
  { id: 'hold', title: 'Отложено', load: () => getProfileList(4, 0) },
  { id: 'drop', title: 'Брошено', load: () => getProfileList(5, 0) },
]

export default function TvLists() {
  const [data, setData] = useState<Record<string, BrowseItem[]>>({})

  useEffect(() => {
    let cancelled = false
    for (const l of LISTS) {
      l.load()
        .then((d) => {
          const items = (d.content || [])
            .map(extractBookmarkRelease)
            .filter((r): r is Release => !!r)
            .map((release) => ({ release }))
          if (!cancelled) setData((prev) => ({ ...prev, [l.id]: items }))
        })
        .catch(() => { if (!cancelled) setData((prev) => ({ ...prev, [l.id]: [] })) })
    }
    return () => { cancelled = true }
  }, [])

  const rows: BrowseRow[] = LISTS
    .map((l) => ({ id: l.id, title: l.title, items: data[l.id] === undefined ? null : data[l.id] }))
    .filter((r) => r.items === null || r.items.length > 0)
  const loaded = LISTS.every((l) => data[l.id] !== undefined)

  if (loaded && rows.length === 0) {
    return <div className="tv-center">Списки пусты — добавляй тайтлы в избранное или списки, и они появятся здесь</div>
  }
  return <TvBrowse rows={rows} kicker="Мои списки" ready={data.watching !== undefined && data.fav !== undefined} />
}
