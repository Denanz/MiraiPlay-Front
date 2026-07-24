import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import { getFilter, searchReleases, extractReleases } from '../api/releases'
import type { Release } from '../api/releases'
import { getProfileList } from '../api/bookmarks'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import '../styles/modern-browse.css'

// Quick category presets (country / status). Genres, years and sort are layered on top.
const TABS: Array<{ label: string; base: Record<string, unknown> }> = [
  { label: 'Все', base: {} },
  { label: 'Аниме', base: { country: 'Япония' } },
  { label: 'Дунхуа', base: { country: 'Китай' } },
  { label: 'Анонсы', base: { status_id: 3 } },
]

const SORTS: Array<{ label: string; value: number }> = [
  { label: 'Обновлённые', value: 0 },
  { label: 'Популярные', value: 1 },
  { label: 'По рейтингу', value: 3 },
]

// Значения соответствуют status.id, который реально возвращает Anixart
// (1 = Вышел, 2 = Выходит/Онгоинг, 3 = Анонс) — см. ReleasePage.tsx.
const STATUSES: Array<{ label: string; value: number }> = [
  { label: 'Вышел', value: 1 },
  { label: 'Онгоинг', value: 2 },
  { label: 'Анонс', value: 3 },
]

const GENRES = [
  'Экшен', 'Приключения', 'Комедия', 'Драма', 'Фэнтези', 'Романтика',
  'Фантастика', 'Сёнен', 'Сёдзё', 'Сэйнэн', 'Повседневность', 'Школа',
  'Спорт', 'Меха', 'Музыка', 'Психологическое', 'Сверхъестественное',
  'Триллер', 'Ужасы', 'Детектив', 'Исторический', 'Военное', 'Магия',
  'Гарем', 'Этти', 'Демоны', 'Вампиры', 'Самураи', 'Космос', 'Игры', 'Пародия',
]

const CURRENT_YEAR = new Date().getFullYear() + 1
const YEARS = Array.from({ length: CURRENT_YEAR - 1965 + 1 }, (_, i) => CURRENT_YEAR - i)

// Снимок ленты на момент ухода со страницы — переживает размонтирование
// (в отличие от useState), поэтому «назад» из карточки тайтла возвращает
// на то же место, а не в начало заново загруженного списка.
interface CatalogSnapshot {
  activeTab: number
  sort: number
  genres: string[]
  yearFrom: number | ''
  yearTo: number | ''
  studio: string
  status: number | ''
  query: string
  releases: Release[]
  page: number
  hasMore: boolean
  scrollY: number
}
let catalogSnapshot: CatalogSnapshot | null = null

function FilterDropdown({
  label, summary, open, onToggle, onClose, align = 'left', children,
}: {
  id?: string; label: string; summary?: string; open: boolean
  onToggle: () => void; onClose: () => void; align?: 'left' | 'right'; children: ReactNode
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-sm border transition-colors ${
          summary
            ? 'border-accent/40 bg-accent/[0.12] text-accent'
            : open
              ? 'border-white/15 bg-white/[0.06] text-text'
              : 'border-white/[0.08] bg-white/[0.03] text-muted hover:text-text hover:border-white/15'
        }`}
      >
        <span>{label}</span>
        {summary && <span className="font-semibold max-w-[120px] truncate">· {summary}</span>}
        <span className={`text-[10px] opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 z-50 min-w-[200px] max-w-[min(80vw,360px)]
                           p-3 rounded-xl bg-elevated border border-white/10 shadow-2xl`}>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

// Native <select> here used to pop the OS's own year list over the whole page —
// unstyled, and on mobile long enough to overlap the card grid below. Custom
// scrollable button lists match every other filter and stay inside the panel.
function YearOptions({ value, onChange }: { value: number | ''; onChange: (v: number | '') => void }) {
  return (
    <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 pr-1">
      <button onClick={() => onChange('')}
        className={`text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${value === '' ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'}`}>
        Любой
      </button>
      {YEARS.map(y => (
        <button key={y} onClick={() => onChange(y)}
          className={`text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${value === y ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'}`}>
          {y}
        </button>
      ))}
    </div>
  )
}

export default function CatalogPage() {
  const navigate = useNavigate()
  const design = useDesign()
  const [searchParams, setSearchParams] = useSearchParams()
  const [surpriseBusy, setSurpriseBusy] = useState(false)

  // Восстанавливаем снимок только при возврате назад/вперёд по истории — обычный
  // переход на страницу (клик по «Каталог» в меню) всегда начинает с чистого листа.
  const navigationType = useNavigationType()
  const restoreSnapshot = navigationType === 'POP' ? catalogSnapshot : null
  const restoredRef = useRef(!!restoreSnapshot)

  // "Сюрприз": jump to a random title from the user's "watching"/"planned" lists.
  const handleSurprise = useCallback(async () => {
    setSurpriseBusy(true)
    try {
      const ids = new Set<number>()
      for (const listId of [1, 2]) {
        for (let pg = 0; pg < 2; pg++) {
          const data = await getProfileList(listId, pg).catch(() => null)
          const items = data?.content || []
          for (const it of items) {
            const id = it.release?.id ?? it.id
            if (id) ids.add(Number(id))
          }
          if (items.length < 20) break
        }
      }
      const pool = [...ids]
      if (pool.length === 0) { alert('Список «Смотрю»/«В планах» пуст — добавь что-нибудь.'); return }
      navigate(`/release/${pool[Math.floor(Math.random() * pool.length)]}`)
    } finally {
      setSurpriseBusy(false)
    }
  }, [navigate])

  const [activeTab, setActiveTab] = useState(() => restoreSnapshot?.activeTab ?? 0)
  const [sort, setSort] = useState(() => restoreSnapshot?.sort ?? 0)
  const [genres, setGenres] = useState<string[]>(() => restoreSnapshot?.genres ?? [])
  const [yearFrom, setYearFrom] = useState<number | ''>(() => restoreSnapshot?.yearFrom ?? '')
  const [yearTo, setYearTo] = useState<number | ''>(() => restoreSnapshot?.yearTo ?? '')
  const [studio, setStudio] = useState(() => restoreSnapshot?.studio ?? '')
  const [studioInput, setStudioInput] = useState(() => restoreSnapshot?.studio ?? '')
  const [status, setStatus] = useState<number | ''>(() => restoreSnapshot?.status ?? '')
  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggleSection = (id: string) => setOpenSection(prev => (prev === id ? null : id))

  // Поиск живёт прямо в каталоге — раньше это была отдельная страница /search.
  // Пока запрос не пуст, фильтры (жанры/год/статус/студия/сортировка/вкладки)
  // не показываются: поисковый эндпоинт Anixart принимает только текст запроса
  // и их бы просто молча игнорировал.
  const [query, setQuery] = useState(() => restoreSnapshot?.query ?? searchParams.get('q') ?? '')
  const [queryInput, setQueryInput] = useState(query)
  const runSearch = (value: string) => {
    setQuery(value)
    setSearchParams(value ? { q: value } : {}, { replace: true })
  }
  const clearSearch = () => { setQueryInput(''); runSearch('') }

  const [releases, setReleases] = useState<Release[]>(() => restoreSnapshot?.releases ?? [])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(() => restoreSnapshot?.page ?? 0)
  const [hasMore, setHasMore] = useState(() => restoreSnapshot?.hasMore ?? true)

  const buildBody = useCallback((pg: number) => {
    const body: Record<string, unknown> = {
      ...TABS[activeTab].base,
      page: pg,
      sort,
      extended_mode: true,
      genres,
      is_genres_exclude_mode_enabled: false,
    }
    if (yearFrom) body.start_year = yearFrom
    if (yearTo) body.end_year = yearTo
    if (studio) body.studio = studio
    if (status) body.status_id = status
    return body
  }, [activeTab, sort, genres, yearFrom, yearTo, studio, status])

  // Guards against out-of-order responses: rapid filter changes (or a filter
  // change landing while a load-more is in flight) can fire overlapping
  // requests. Only the response matching the latest issued request is applied
  // — an earlier one resolving later would otherwise clobber fresher state.
  const requestIdRef = useRef(0)

  const loadReleases = useCallback(async (pg: number, replace = false) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const data = query.trim()
        ? await searchReleases(query.trim(), pg)
        : await getFilter(pg, buildBody(pg))
      if (requestId !== requestIdRef.current) return
      const items: Release[] = extractReleases(data)
      setReleases(prev => replace ? items : [...prev, ...items])
      setHasMore(items.length >= 20)
    } catch {
      if (requestId === requestIdRef.current && replace) setReleases([])
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [buildBody, query])

  // Reload whenever any filter changes — but not on the very first run after
  // restoring a snapshot, otherwise "назад" would immediately wipe the
  // restored list and start over from page 0.
  useEffect(() => {
    if (restoredRef.current) { restoredRef.current = false; return }
    setPage(0)
    setReleases([])
    setHasMore(true)
    loadReleases(0, true)
  }, [loadReleases])

  // Текущая прокрутка — в ref, а не читается по требованию: к моменту, когда
  // отработает cleanup-эффект размонтирования, React уже подменил DOM на
  // содержимое следующей страницы, и window.scrollY к этому моменту отражает
  // ЕЁ (обычно более короткую) высоту.
  //
  // Фиксируем ТОЛЬКО на pointerdown, не на 'scroll' и не таймером/rAF.
  // Дело не в том, что событие 'scroll' не долетает — а в обратном: обычный
  // useEffect снимает обработчик АСИНХРОННО, уже после того как React обменял
  // DOM на содержимое следующей страницы. Если что-то продолжает слушать
  // 'scroll' (или просто периодически перечитывает window.scrollY) в этом
  // промежутке, оно ловит момент, когда браузер уже поджал прокрутку под
  // высоту НОВОЙ (обычно куда более короткой) страницы, и затирает этим нулём
  // уже верно сохранённое значение. pointerdown — разовое событие ровно в
  // момент намерения перейти, ещё до того как переход вообще начался.
  const scrollYRef = useRef(0)
  useEffect(() => {
    const onPointerDown = () => { scrollYRef.current = window.scrollY }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [])

  // Прокрутка к сохранённому месту — после того как восстановленный список
  // уже в разметке (иначе страница ещё недостаточно высокая для scrollTo).
  // Догрузка следующей страницы (если сразу после восстановления сработал
  // сторож бесконечной прокрутки) меняет высоту документа и может сбить
  // только что применённую позицию — поэтому в течение короткого окна после
  // возврата позиция всё время удерживается заново, кадр за кадром, а не
  // выставляется один раз.
  useEffect(() => {
    if (!restoreSnapshot) return
    const y = restoreSnapshot.scrollY
    scrollYRef.current = y
    let raf = 0
    const until = Date.now() + 1500
    const hold = () => {
      if (window.scrollY !== y) window.scrollTo(0, y)
      if (Date.now() < until) raf = requestAnimationFrame(hold)
    }
    raf = requestAnimationFrame(hold)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Снимок обновляется на каждый рендер и сохраняется при уходе со страницы.
  const snapshotRef = useRef<CatalogSnapshot>()
  snapshotRef.current = { activeTab, sort, genres, yearFrom, yearTo, studio, status, query, releases, page, hasMore, scrollY: 0 }
  useEffect(() => {
    return () => {
      if (snapshotRef.current) {
        catalogSnapshot = { ...snapshotRef.current, scrollY: scrollYRef.current }
      }
    }
  }, [])

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    loadReleases(nextPage)
  }, [page, loadReleases])

  // Infinite scroll: load the next page when the sentinel scrolls into view
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) loadMore()
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadMore])

  const toggleGenre = (g: string) => {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const resetFilters = () => {
    setSort(0)
    setGenres([])
    setYearFrom('')
    setYearTo('')
    setStudio('')
    setStudioInput('')
    setStatus('')
  }

  const activeFilterCount = useMemo(
    () => genres.length + (yearFrom ? 1 : 0) + (yearTo ? 1 : 0) + (sort ? 1 : 0)
      + (studio ? 1 : 0) + (status ? 1 : 0),
    [genres, yearFrom, yearTo, sort, studio, status],
  )

  if (design === 'modern') {
    return (
      <div>
        <div className="mdk-rowhead">
          <div>
            <h2>Каталог</h2>
            {query && <div className="mdk-cs" style={{ marginTop: 4 }}>Поиск: «{query}»</div>}
          </div>
        </div>
        <div className="mdp-browse-filters mdk-glass mdk-pad">
          <form onSubmit={e => { e.preventDefault(); runSearch(queryInput.trim()) }} className="mdp-browse-search">
            <svg viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5" /></svg>
            <input value={queryInput} onChange={e => setQueryInput(e.target.value)} placeholder="Название, жанр или студия…" />
            {query && <button type="button" onClick={clearSearch} aria-label="Очистить поиск">✕</button>}
          </form>
          {!query && (
            <>
              <span className="mdp-browse-sep" />
              {TABS.map((tab, i) => (
                <button key={i} className={`mdk-chip ${activeTab === i ? 'mdk-chip-acc' : ''}`} onClick={() => setActiveTab(i)}>
                  {tab.label}
                </button>
              ))}
              <span className="mdp-browse-sep" />
              <FilterDropdown label="Жанры" summary={genres.length ? `${genres.length}` : undefined}
                open={openSection === 'genres'} onToggle={() => toggleSection('genres')} onClose={() => setOpenSection(null)}>
                <div className="flex gap-1.5 flex-wrap max-h-72 overflow-y-auto">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => toggleGenre(g)} className={`chip ${genres.includes(g) ? 'chip-active' : ''}`}>{g}</button>
                  ))}
                </div>
              </FilterDropdown>
              <FilterDropdown label="Год" summary={yearFrom || yearTo ? `${yearFrom || '…'}–${yearTo || '…'}` : undefined}
                open={openSection === 'year'} onToggle={() => toggleSection('year')} onClose={() => setOpenSection(null)}>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="text-[11px] text-muted mb-1 px-1">От</div>
                    <YearOptions value={yearFrom} onChange={setYearFrom} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-muted mb-1 px-1">До</div>
                    <YearOptions value={yearTo} onChange={setYearTo} />
                  </div>
                </div>
              </FilterDropdown>
              <FilterDropdown label="Статус" summary={STATUSES.find(s => s.value === status)?.label}
                open={openSection === 'status'} onToggle={() => toggleSection('status')} onClose={() => setOpenSection(null)}>
                <div className="flex flex-col gap-1">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => { setStatus(status === s.value ? '' : s.value); setOpenSection(null) }}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${status === s.value ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'}`}>{s.label}</button>
                  ))}
                </div>
              </FilterDropdown>
              <FilterDropdown label="Студия" summary={studio || undefined}
                open={openSection === 'studio'} onToggle={() => toggleSection('studio')} onClose={() => setOpenSection(null)}>
                <form onSubmit={e => { e.preventDefault(); setStudio(studioInput.trim()); setOpenSection(null) }}>
                  <input autoFocus value={studioInput} onChange={e => setStudioInput(e.target.value)} placeholder="напр. MAPPA" className="input !py-2 !px-2.5 text-sm w-full mb-2" />
                  <div className="flex gap-2">
                    <button type="submit" className="chip chip-active flex-1">Применить</button>
                    {studio && <button type="button" onClick={() => { setStudio(''); setStudioInput(''); setOpenSection(null) }} className="chip">Сброс</button>}
                  </div>
                </form>
              </FilterDropdown>
              <span style={{ flex: 1 }} />
              <FilterDropdown label="Сортировка" summary={SORTS.find(s => s.value === sort)?.label} align="right"
                open={openSection === 'sort'} onToggle={() => toggleSection('sort')} onClose={() => setOpenSection(null)}>
                <div className="flex flex-col gap-1">
                  {SORTS.map(s => (
                    <button key={s.value} onClick={() => { setSort(s.value); setOpenSection(null) }}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${sort === s.value ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'}`}>{s.label}</button>
                  ))}
                </div>
              </FilterDropdown>
            </>
          )}
          <button className="mdk-btn mdk-btn-ghost" onClick={handleSurprise} disabled={surpriseBusy}>🎲 {surpriseBusy ? 'Выбираю…' : 'Сюрприз'}</button>
        </div>

        {!query && (genres.length > 0 || activeFilterCount > 0) && (
          <div className="mdp-browse-genrow">
            {genres.map(g => <span key={g} className="mdk-chip mdk-chip-acc" onClick={() => toggleGenre(g)} style={{ cursor: 'pointer' }}>{g} ✕</span>)}
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="mdk-chip">Сбросить ({activeFilterCount})</button>
            )}
          </div>
        )}

        {loading && releases.length === 0 ? (
          <Spinner variant="grid" />
        ) : releases.length === 0 ? (
          <div className="text-center text-muted py-20 text-sm">
            {query ? `Ничего не найдено по запросу «${query}»` : 'Ничего не найдено по выбранным фильтрам'}
          </div>
        ) : (
          <>
            <div className="mdk-grid">
              {releases.map(r => <ReleaseCard key={r.id} release={r} />)}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="mt-10 flex justify-center">
                {loading && <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-accent animate-spin" />}
              </div>
            )}
          </>
        )}

        <BackToTop />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold">
          Каталог{query && <span className="text-muted font-normal text-base ml-2">· «{query}»</span>}
        </h1>
        <button
          onClick={handleSurprise}
          disabled={surpriseBusy}
          title="Случайный тайтл из «Смотрю»/«В планах»"
          className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-sm font-medium border border-accent/40 bg-accent/[0.10] text-accent hover:bg-accent/[0.18] transition-colors disabled:opacity-50"
        >
          🎲 {surpriseBusy ? 'Выбираю…' : 'Сюрприз'}
        </button>
      </div>

      <form onSubmit={e => { e.preventDefault(); runSearch(queryInput.trim()) }} className="flex gap-2 mb-5 max-w-xl">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder="Название, жанр или студия…"
            className="input pl-10"
          />
        </div>
        <button type="submit" className="btn-primary">Найти</button>
        {query && <button type="button" onClick={clearSearch} className="btn-ghost">Сброс</button>}
      </form>

      {!query && (
        <>
          {/* Category presets */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {TABS.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`tab ${activeTab === i ? 'tab-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter bar — compact pills that open popovers */}
          <div className="flex flex-wrap items-center gap-2 mb-7">
            <FilterDropdown label="Сортировка" summary={SORTS.find(s => s.value === sort)?.label}
              open={openSection === 'sort'} onToggle={() => toggleSection('sort')} onClose={() => setOpenSection(null)}>
              <div className="flex flex-col gap-1">
                {SORTS.map(s => (
                  <button key={s.value} onClick={() => { setSort(s.value); setOpenSection(null) }}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      sort === s.value ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'
                    }`}>{s.label}</button>
                ))}
              </div>
            </FilterDropdown>

            <FilterDropdown label="Год" summary={yearFrom || yearTo ? `${yearFrom || '…'}–${yearTo || '…'}` : undefined}
              open={openSection === 'year'} onToggle={() => toggleSection('year')} onClose={() => setOpenSection(null)}>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[11px] text-muted mb-1 px-1">От</div>
                  <YearOptions value={yearFrom} onChange={setYearFrom} />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted mb-1 px-1">До</div>
                  <YearOptions value={yearTo} onChange={setYearTo} />
                </div>
              </div>
            </FilterDropdown>

            <FilterDropdown label="Статус" summary={STATUSES.find(s => s.value === status)?.label}
              open={openSection === 'status'} onToggle={() => toggleSection('status')} onClose={() => setOpenSection(null)}>
              <div className="flex flex-col gap-1">
                {STATUSES.map(s => (
                  <button key={s.value} onClick={() => { setStatus(status === s.value ? '' : s.value); setOpenSection(null) }}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      status === s.value ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'
                    }`}>{s.label}</button>
                ))}
              </div>
            </FilterDropdown>

            <FilterDropdown label="Студия" summary={studio || undefined}
              open={openSection === 'studio'} onToggle={() => toggleSection('studio')} onClose={() => setOpenSection(null)}>
              <form onSubmit={e => { e.preventDefault(); setStudio(studioInput.trim()); setOpenSection(null) }}>
                <input autoFocus value={studioInput} onChange={e => setStudioInput(e.target.value)}
                  placeholder="напр. MAPPA" className="input !py-2 !px-2.5 text-sm w-full mb-2" />
                <div className="flex gap-2">
                  <button type="submit" className="chip chip-active flex-1">Применить</button>
                  {studio && <button type="button" onClick={() => { setStudio(''); setStudioInput(''); setOpenSection(null) }} className="chip">Сброс</button>}
                </div>
              </form>
            </FilterDropdown>

            <FilterDropdown label="Жанры" summary={genres.length ? `${genres.length}` : undefined}
              open={openSection === 'genres'} onToggle={() => toggleSection('genres')} onClose={() => setOpenSection(null)}>
              <div className="flex gap-1.5 flex-wrap max-h-72 overflow-y-auto">
                {GENRES.map(g => (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className={`chip ${genres.includes(g) ? 'chip-active' : ''}`}>{g}</button>
                ))}
              </div>
            </FilterDropdown>

            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-sm text-accent-soft hover:underline ml-1">
                Сбросить ({activeFilterCount})
              </button>
            )}
          </div>
        </>
      )}

      {loading && releases.length === 0 ? (
        <Spinner variant="grid" />
      ) : releases.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">
          {query ? `Ничего не найдено по запросу «${query}»` : 'Ничего не найдено по выбранным фильтрам'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {releases.map(r => (
              <ReleaseCard key={r.id} release={r} />
            ))}
          </div>
          {/* Infinite-scroll sentinel + loading indicator */}
          {hasMore && (
            <div ref={sentinelRef} className="mt-10 flex justify-center">
              {loading && <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-accent animate-spin" />}
            </div>
          )}
        </>
      )}

      <BackToTop />
    </div>
  )
}

function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-accent text-[#130d1c] shadow-lg
                 flex items-center justify-center text-lg active:scale-95 transition-transform"
      aria-label="Наверх"
    >
      ↑
    </button>
  )
}
