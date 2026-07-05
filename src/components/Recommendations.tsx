import { useEffect, useState } from 'react'
import { getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import { getFilter, extractReleases, genreList } from '../api/releases'
import type { Release } from '../api/releases'
import ReleaseCard from './ReleaseCard'
import { useDesign } from '../lib/design'

// Profile-list IDs (shared meaning with BookmarksPage.tsx): 1 Смотрю, 2 В планах,
// 3 Просмотрено, 4 Отложено, 5 Брошено.
// Taste signal comes only from anime actually watched (watching/completed) — planned
// or dropped titles don't tell us what the user likes. Everything tracked in any list
// is excluded from the results so we never recommend something already on the radar.
const TASTE_LISTS = [1, 3]
const ALL_LISTS = [1, 2, 3, 4, 5]

export default function Recommendations() {
  const design = useDesign()
  const [items, setItems] = useState<Release[]>([])

  useEffect(() => {
    let cancelled = false
    if (!localStorage.getItem('anixart_token')) return

    ;(async () => {
      try {
        const lists = await Promise.all(ALL_LISTS.map((id) => getProfileList(id, 0).catch(() => null)))
        const seen = new Set<number>()
        const genreCount = new Map<string, number>()

        ALL_LISTS.forEach((listId, i) => {
          const releases = (lists[i]?.content || [])
            .map(extractBookmarkRelease)
            .filter((r): r is Release => !!r)
          for (const r of releases) {
            seen.add(Number(r.id))
            if (TASTE_LISTS.includes(listId)) {
              for (const g of genreList(r.genres)) genreCount.set(g, (genreCount.get(g) || 0) + 1)
            }
          }
        })

        if (genreCount.size === 0) return

        const topGenres = [...genreCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([g]) => g)

        const data = await getFilter(0, {
          genres: topGenres, sort: 1, page: 0,
          extended_mode: true, is_genres_exclude_mode_enabled: false,
        })
        const candidates = extractReleases(data).filter((r) => !seen.has(r.id))
        if (!cancelled) setItems(candidates.slice(0, 18))
      } catch {
        /* best-effort — leave the section hidden on failure */
      }
    })()

    return () => { cancelled = true }
  }, [])

  if (items.length === 0) return null

  if (design === 'modern') {
    return (
      <>
        <div className="mdk-rowhead"><h2>Рекомендации для вас</h2></div>
        <div className="mdk-track">
          {items.map((r) => <ReleaseCard key={r.id} release={r} />)}
        </div>
      </>
    )
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Рекомендации для вас</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((r) => (
          <div key={r.id} className="shrink-0 w-32 sm:w-36 snap-start">
            <ReleaseCard release={r} />
          </div>
        ))}
      </div>
    </section>
  )
}
