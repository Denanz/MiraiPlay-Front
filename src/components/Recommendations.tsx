import { useEffect, useState } from 'react'
import { getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import { getFilter, extractReleases, genreList } from '../api/releases'
import type { Release } from '../api/releases'
import ReleaseCard from './ReleaseCard'
import { useDesign } from '../lib/design'
import { SESSION_SEED, mulberry32, shuffled } from '../lib/sessionRandom'

// Profile-list IDs (shared meaning with BookmarksPage.tsx): 1 Смотрю, 2 В планах,
// 3 Просмотрено, 4 Отложено, 5 Брошено.
// Taste signal comes only from anime actually watched (watching/completed) — planned
// or dropped titles don't tell us what the user likes. Everything tracked in any list
// is excluded from the results so we never recommend something already on the radar.
const TASTE_LISTS = [1, 3]
const ALL_LISTS = [1, 2, 3, 4, 5]

// Раньше подборка была полностью детерминированной (топ-4 жанра, всегда страница 0,
// всегда первые 18), поэтому на каждом входе показывалось одно и то же.

/** Жанров берём шире топ-4, чтобы было из чего выбирать. */
const GENRE_POOL = 8
const GENRES_PER_RUN = 4
/** Верхние страницы выдачи: глубже уходить не стоит — там уже слабые тайтлы. */
const MAX_PAGE = 3

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

        const ranked = [...genreCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([g]) => g)

        const rnd = mulberry32(SESSION_SEED)
        // Случайная выборка из более широкого пула любимых жанров + случайная
        // страница выдачи — два независимых источника разнообразия.
        const pickedGenres = shuffled(ranked.slice(0, GENRE_POOL), rnd).slice(0, GENRES_PER_RUN)
        const page = Math.floor(rnd() * MAX_PAGE)

        const fetchPage = async (genres: string[], pg: number) => {
          const data = await getFilter(pg, {
            genres, sort: 1, page: pg,
            extended_mode: true, is_genres_exclude_mode_enabled: false,
          })
          return extractReleases(data).filter((r) => !seen.has(r.id))
        }

        let candidates = await fetchPage(pickedGenres, page)
        // Подстраховка: случайная комбинация жанров или глубокая страница может дать
        // пусто. Тогда возвращаемся ровно к прежнему поведению (топ-4, страница 0),
        // чтобы новая логика ни при каких условиях не оказалась хуже старой.
        if (candidates.length < 6) {
          candidates = await fetchPage(ranked.slice(0, 4), 0)
        }

        // Перемешиваем и сам порядок карточек — тогда даже одинаковая выдача
        // выглядит по-новому.
        if (!cancelled) setItems(shuffled(candidates, rnd).slice(0, 18))
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
