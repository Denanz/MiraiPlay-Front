import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSchedule, DAYS, DAY_LABELS, todayKey, SEASONS, currentSeason, type Weekday } from '../api/schedule'
import { getFilter, extractReleases, type Release } from '../api/releases'
import { getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import { useAuth } from '../store/auth'
import { img } from '../lib/img'
import Img from '../components/Img'
import '../styles/modern-schedule.css'

/** Все id из списков «Смотрю» и «В планах» — для фильтра «только мои» в расписании. */
async function loadMyOngoingIds(): Promise<Set<number>> {
  const ids = new Set<number>()
  for (const listId of [1, 2]) {
    for (let page = 0; page < 20; page++) {
      let content: ReturnType<typeof extractBookmarkRelease>[] = []
      let count = 0
      try {
        const data = await getProfileList(listId, page)
        count = (data.content || []).length
        content = (data.content || []).map(extractBookmarkRelease)
      } catch {
        break
      }
      for (const r of content) if (r) ids.add(r.id)
      if (count < 20) break
    }
  }
  return ids
}

type Mode = 'schedule' | 'seasons'

const NOW_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: NOW_YEAR + 1 - 1990 + 1 }, (_, i) => NOW_YEAR + 1 - i)

export default function SchedulePage() {
  const design = useDesign()
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('schedule')

  // ── Schedule (airing calendar) ──
  const [schedule, setSchedule] = useState<Record<Weekday, Release[]> | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const today = todayKey()

  useEffect(() => {
    if (mode !== 'schedule' || schedule) return
    setLoadingSchedule(true)
    getSchedule().then(setSchedule).catch(() => setSchedule(null)).finally(() => setLoadingSchedule(false))
  }, [mode, schedule])

  // «Только мои» — сузить недельное расписание до того, что уже смотрю
  // или запланировал(а), а не листать всё, что вообще выходит на неделе.
  const [onlyMine, setOnlyMine] = useState(false)
  const [myIds, setMyIds] = useState<Set<number> | null>(null)
  const [loadingMine, setLoadingMine] = useState(false)
  useEffect(() => {
    if (!onlyMine || myIds || !session) return
    setLoadingMine(true)
    loadMyOngoingIds().then(setMyIds).finally(() => setLoadingMine(false))
  }, [onlyMine, myIds, session])

  const filterMine = (items: Release[]): Release[] =>
    onlyMine && myIds ? items.filter(r => myIds.has(r.id)) : items


  // ── Seasons ──
  const [season, setSeason] = useState(currentSeason())
  const [year, setYear] = useState(NOW_YEAR)
  const [seasonItems, setSeasonItems] = useState<Release[]>([])
  const [loadingSeason, setLoadingSeason] = useState(false)

  useEffect(() => {
    if (mode !== 'seasons') return
    setLoadingSeason(true)
    getFilter(0, { season, start_year: year, end_year: year, sort: 1, extended_mode: true })
      .then(d => setSeasonItems(extractReleases(d)))
      .catch(() => setSeasonItems([]))
      .finally(() => setLoadingSeason(false))
  }, [mode, season, year])

  const orderedDays = useMemo(() => {
    // Start the week at today for relevance
    const start = DAYS.indexOf(today)
    return [...DAYS.slice(start), ...DAYS.slice(0, start)]
  }, [today])

  if (design === 'modern') {
    return (
      <div>
        <div className="mdk-rowhead" style={{ marginTop: 0 }}>
          <div>
            <h1 className="text-2xl font-display font-semibold">Расписание</h1>
            <p className="text-xs text-white/50 mt-1">
              {mode === 'schedule' ? 'онгоинги · эта неделя' : 'фильтр по сезону и году'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMode('schedule')} className={`mdk-chip ${mode === 'schedule' ? 'mdk-chip-acc' : ''}`}>📅 Онгоинги</button>
            <button onClick={() => setMode('seasons')} className={`mdk-chip ${mode === 'seasons' ? 'mdk-chip-acc' : ''}`}>🍂 Сезоны</button>
            {mode === 'schedule' && session && (
              <button onClick={() => setOnlyMine(v => !v)} className={`mdk-chip ${onlyMine ? 'mdk-chip-acc' : ''}`}>
                {loadingMine ? '…' : '★ Только мои'}
              </button>
            )}
          </div>
        </div>

        {mode === 'schedule' ? (
          loadingSchedule ? (
            <Spinner variant="grid" />
          ) : !schedule ? (
            <div className="text-center text-muted py-20 text-sm">Не удалось загрузить расписание</div>
          ) : onlyMine && myIds && orderedDays.every(day => filterMine(schedule[day]).length === 0) ? (
            <div className="text-center text-muted py-20 text-sm">На этой неделе ничего из «Смотрю» и «В планах» не выходит</div>
          ) : (
            <div className="mdp-schedule-week">
              {orderedDays.map(day => {
                const items = filterMine(schedule[day])
                const isToday = day === today
                return (
                  <div key={day} className={`mdp-schedule-day ${isToday ? 'today' : ''}`}>
                    <h3>
                      {DAY_LABELS[day]}
                      {isToday && <span className="mdp-schedule-daynum">{items.length}</span>}
                    </h3>
                    {items.length === 0 && <p className="text-[11px] text-white/25">—</p>}
                    {items.map(r => {
                      const poster = img(r.image || '')
                      return (
                        <Link key={r.id} to={`/release/${r.id}`} className="mdp-schedule-item">
                          {poster ? (
                            <Img src={poster} proxy={false} alt={r.title_ru} className="mdp-schedule-th" imgClassName="w-full h-full object-cover" />
                          ) : (
                            <div className="mdp-schedule-th" />
                          )}
                          <div className="min-w-0">
                            <div className="mdp-schedule-nm">{r.title_ru}</div>
                            {r.episodes_released != null && (
                              <div className="mdp-schedule-ep">
                                Эп. {r.episodes_released}{r.episodes_total ? ` / ${r.episodes_total}` : ''}
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <div>
            <div className="mdk-glass mdk-pad flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-white/40">Сезон</span>
                <div className="flex gap-1.5 flex-wrap">
                  {SEASONS.map(s => (
                    <button key={s.id} onClick={() => setSeason(s.id)} className={`mdk-chip ${season === s.id ? 'mdk-chip-acc' : ''}`}>
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-white/40">Год</span>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="input !py-1.5 !px-2.5 text-sm">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {loadingSeason ? (
              <Spinner variant="grid" />
            ) : seasonItems.length === 0 ? (
              <div className="text-center text-muted py-20 text-sm">В этом сезоне ничего не найдено</div>
            ) : (
              <div className="mdk-grid">
                {seasonItems.map(r => <ReleaseCard key={r.id} release={r} />)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Расписание</h1>

      <div className="flex gap-1.5 mb-6 items-center">
        <button onClick={() => setMode('schedule')} className={`tab ${mode === 'schedule' ? 'tab-active' : ''}`}>📅 Онгоинги</button>
        <button onClick={() => setMode('seasons')} className={`tab ${mode === 'seasons' ? 'tab-active' : ''}`}>🍂 Сезоны</button>
        {mode === 'schedule' && session && (
          <button onClick={() => setOnlyMine(v => !v)} className={`chip ml-auto ${onlyMine ? 'chip-active' : ''}`}>
            {loadingMine ? '…' : '★ Только мои'}
          </button>
        )}
      </div>

      {mode === 'schedule' ? (
        loadingSchedule ? (
          <Spinner variant="grid" />
        ) : !schedule ? (
          <div className="text-center text-muted py-20 text-sm">Не удалось загрузить расписание</div>
        ) : onlyMine && myIds && orderedDays.every(day => filterMine(schedule[day]).length === 0) ? (
          <div className="text-center text-muted py-20 text-sm">На этой неделе ничего из «Смотрю» и «В планах» не выходит</div>
        ) : (
          <div className="space-y-8">
            {orderedDays.map(day => {
              const items = filterMine(schedule[day])
              if (!items.length) return null
              return (
                <section key={day}>
                  <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    {DAY_LABELS[day]}
                    {day === today && <span className="chip chip-active !py-0.5 text-xs">сегодня</span>}
                    <span className="text-xs text-muted font-normal">· {items.length}</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {items.map(r => (
                      <div key={r.id} className="relative">
                        <ReleaseCard release={r} />
                        {(r.episodes_released != null) && (
                          <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/75 backdrop-blur-sm">
                            {r.episodes_released}{r.episodes_total ? ` / ${r.episodes_total}` : ''} эп.
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )
      ) : (
        <div>
          <div className="panel p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Сезон</span>
              <div className="flex gap-1.5 flex-wrap">
                {SEASONS.map(s => (
                  <button key={s.id} onClick={() => setSeason(s.id)} className={`chip ${season === s.id ? 'chip-active' : ''}`}>
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">Год</span>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="input !py-1.5 !px-2.5 text-sm">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {loadingSeason ? (
            <Spinner variant="grid" />
          ) : seasonItems.length === 0 ? (
            <div className="text-center text-muted py-20 text-sm">В этом сезоне ничего не найдено</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {seasonItems.map(r => <ReleaseCard key={r.id} release={r} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
