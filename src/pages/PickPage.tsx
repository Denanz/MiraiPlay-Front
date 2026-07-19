import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import { getFilter, extractReleases, genreList, type Release } from '../api/releases'
import { img } from '../lib/img'
import { mulberry32, shuffled } from '../lib/sessionRandom'
import Spinner from '../components/Spinner'

// Списки профиля: 1 Смотрю, 2 В планах, 3 Просмотрено, 4 Отложено, 5 Брошено.
const PLANNED = 2
const TASTE_LISTS = [1, 3]
const ALL_LISTS = [1, 2, 3, 4, 5]

/** Сколько вариантов показываем за раз. Больше трёх — снова выбор, а не решение. */
const DEAL = 3

export default function PickPage() {
  const navigate = useNavigate()
  const [pool, setPool] = useState<Release[]>([])
  const [deal, setDeal] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lists = await Promise.all(ALL_LISTS.map((id) => getProfileList(id, 0).catch(() => null)))
        const seen = new Set<number>()
        const genreCount = new Map<string, number>()
        let planned: Release[] = []

        ALL_LISTS.forEach((listId, i) => {
          const releases = (lists[i]?.content || [])
            .map(extractBookmarkRelease)
            .filter((r): r is Release => !!r)
          for (const r of releases) {
            // «В планах» — единственный список, из которого можно предлагать:
            // остальные либо уже смотрятся, либо осознанно отложены и брошены.
            if (listId === PLANNED) planned.push(r)
            else seen.add(Number(r.id))
            if (TASTE_LISTS.includes(listId)) {
              for (const g of genreList(r.genres)) genreCount.set(g, (genreCount.get(g) || 0) + 1)
            }
          }
        })

        // Если в планах пусто или почти пусто, добираем по любимым жанрам —
        // иначе экран решения нечем наполнить.
        let candidates = planned
        if (candidates.length < DEAL * 2 && genreCount.size > 0) {
          const topGenres = [...genreCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([g]) => g)
          try {
            const data = await getFilter(0, {
              genres: topGenres, sort: 1, page: 0,
              extended_mode: true, is_genres_exclude_mode_enabled: false,
            })
            const extra = extractReleases(data).filter(
              (r) => !seen.has(r.id) && !planned.some((p) => p.id === r.id),
            )
            candidates = [...candidates, ...extra]
          } catch { /* добор не критичен */ }
        }

        if (cancelled) return
        setPool(candidates)
        if (candidates.length === 0) setErr('Нечего предложить — добавьте что-нибудь в «В планах».')
      } catch {
        if (!cancelled) setErr('Не удалось загрузить списки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Каждая раздача — свой сид, иначе «перетасовать» возвращало бы то же самое.
  const reshuffle = useCallback(() => {
    if (pool.length === 0) return
    const rnd = mulberry32((Math.random() * 2 ** 32) >>> 0)
    setDeal(shuffled(pool, rnd).slice(0, DEAL))
  }, [pool])

  useEffect(() => { reshuffle() }, [reshuffle])

  if (loading) return <Spinner />

  return (
    <section className="mb-6">
      <h1 className="font-display text-2xl mb-1">Выбери за меня</h1>
      <p className="text-sm text-muted mb-5">
        Три варианта из «В планах» и подходящего по вкусу. Не подошло — перетасуйте.
      </p>

      {err && <p className="text-sm text-muted">{err}</p>}

      {deal.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {deal.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/watch/${r.id}`)}
                className="text-left group rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02] hover:border-accent/50 transition-colors"
              >
                <div className="aspect-[2/3] bg-white/[0.04]">
                  {r.image && (
                    <img src={img(r.image)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium line-clamp-2">{r.title_ru}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-1">
                    {[r.year, genreList(r.genres).slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-[11px] text-accent mt-2">▶ Начать смотреть</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={reshuffle} className="btn-ghost">Перетасовать</button>
            <span className="text-xs text-muted self-center">вариантов в запасе: {pool.length}</span>
          </div>
        </>
      )}
    </section>
  )
}
