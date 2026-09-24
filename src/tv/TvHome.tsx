import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFilter, extractReleases, getRelease, type Release } from '../api/releases'
import { getAccountContinueWatching } from '../api/episodes'
import { getContinueWatching, watchedPct } from '../api/progress'
import { getSchedule, todayKey } from '../api/schedule'
import { getSpotlightOverride } from '../api/admin'
import { resumeWatch } from '../lib/resume'
import TvBrowse, { type BrowseItem, type BrowseRow } from './TvBrowse'

const ROW_LIMIT = 20

// Ряды главной: запрос на каждый, грузятся параллельно и появляются по готовности.
const FILTER_ROWS: Array<{ id: string; title: string; body: Record<string, unknown> }> = [
  { id: 'popular', title: 'Популярное', body: { sort: 1 } },
  { id: 'fresh', title: 'Недавно обновлённые', body: { sort: 0 } },
  { id: 'top', title: 'Лучшее по рейтингу', body: { sort: 3 } },
  { id: 'g-action', title: 'Экшен', body: { sort: 1, genres: ['Экшен'] } },
  { id: 'g-romance', title: 'Романтика', body: { sort: 1, genres: ['Романтика'] } },
  { id: 'g-comedy', title: 'Комедия', body: { sort: 1, genres: ['Комедия'] } },
  { id: 'g-fantasy', title: 'Фэнтези', body: { sort: 1, genres: ['Фэнтези'] } },
  { id: 'g-sol', title: 'Повседневность', body: { sort: 1, genres: ['Повседневность'] } },
]

const asItems = (list: Release[]): BrowseItem[] => list.slice(0, ROW_LIMIT).map((release) => ({ release }))

export default function TvHome() {
  const navigate = useNavigate()
  const [cont, setCont] = useState<BrowseItem[] | null>(null)
  const [today, setToday] = useState<BrowseItem[] | null>(null)
  const [lists, setLists] = useState<Record<string, BrowseItem[] | null>>({})
  const [spotlight, setSpotlight] = useState<Release | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([getAccountContinueWatching(), getContinueWatching()])
      .then(([entries, exact]) => {
        if (cancelled) return
        setCont(entries.slice(0, ROW_LIMIT).map((e) => {
          const at = exact.find((x) => x.releaseId === e.releaseId && Number(x.episode) === e.episodePosition)
          return {
            release: { id: Number(e.releaseId), title_ru: e.releaseTitle || '', image: e.releaseImage },
            badge: `Серия ${e.episodePosition}`,
            progress: at ? watchedPct(at.position, at.duration) : undefined,
            onPick: () => resumeWatch(navigate, e),
          }
        }))
      })
      .catch(() => { if (!cancelled) setCont([]) })

    getSchedule()
      .then((s) => { if (!cancelled) setToday(asItems(s[todayKey()] || [])) })
      .catch(() => { if (!cancelled) setToday([]) })

    for (const row of FILTER_ROWS) {
      getFilter(0, { genres: [], is_genres_exclude_mode_enabled: false, extended_mode: true, ...row.body })
        .then((d) => { if (!cancelled) setLists((prev) => ({ ...prev, [row.id]: asItems(extractReleases(d)) })) })
        .catch(() => { if (!cancelled) setLists((prev) => ({ ...prev, [row.id]: [] })) })
    }

    // Закреплённый владельцем тайтл — в баннер, пока фокус ни на чём не стоял.
    getSpotlightOverride()
      .then((id) => (id ? getRelease(id) : null))
      .then((d) => {
        const r = d && (d.release || extractReleases(d)[0])
        if (!cancelled && r) setSpotlight(r)
      })
      .catch(() => { /* обойдёмся первым тайтлом */ })

    return () => { cancelled = true }
  }, [navigate])

  const rows: BrowseRow[] = [
    { id: 'continue', title: 'Продолжить просмотр', items: cont },
    { id: 'today', title: 'Выходит сегодня', items: today },
    ...FILTER_ROWS.map((r) => ({ id: r.id, title: r.title, items: lists[r.id] === undefined ? null : lists[r.id] })),
  ].filter((r) => r.items === null || r.items.length > 0)

  return <TvBrowse rows={rows} fallback={spotlight} kicker="MiraiPlay" ready={cont !== null && today !== null} />
}
