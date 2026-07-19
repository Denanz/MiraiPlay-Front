import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFilter, extractReleases } from '../api/releases'
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

const STATUSES: Array<{ label: string; value: number }> = [
  { label: 'Вышел', value: 2 },
  { label: 'Онгоинг', value: 1 },
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

export default function CatalogPage() {
  const navigate = useNavigate()
  const design = useDesign()
  const [surpriseBusy, setSurpriseBusy] = useState(false)

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

  const [activeTab, setActiveTab] = useState(0)
  const [sort, setSort] = useState(0)
  const [genres, setGenres] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState<number | ''>('')
  const [yearTo, setYearTo] = useState<number | ''>('')
  const [studio, setStudio] = useState('')
  const [studioInput, setStudioInput] = useState('')
  const [status, setStatus] = useState<number | ''>('')
  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggleSection = (id: string) => setOpenSection(prev => (prev === id ? null : id))

  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

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
      const data = await getFilter(pg, buildBody(pg))
      if (requestId !== requestIdRef.current) return
      const items: Release[] = extractReleases(data)
      setReleases(prev => replace ? items : [...prev, ...items])
      setHasMore(items.length >= 20)
    } catch {
      if (requestId === requestIdRef.current && replace) setReleases([])
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [buildBody])

  // Reload whenever any filter changes
  useEffect(() => {
    setPage(0)
    setReleases([])
    setHasMore(true)
    loadReleases(0, true)
  }, [loadReleases])

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
        <div className="mdk-rowhead"><h2>Каталог</h2></div>
        <div className="mdp-browse-filters mdk-glass mdk-pad">
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
            <div className="flex items-center gap-2">
              <select value={yearFrom} onChange={e => setYearFrom(e.target.value ? Number(e.target.value) : '')} className="input !py-2 !px-2.5 text-sm flex-1">
                <option value="">от</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-muted">—</span>
              <select value={yearTo} onChange={e => setYearTo(e.target.value ? Number(e.target.value) : '')} className="input !py-2 !px-2.5 text-sm flex-1">
                <option value="">до</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
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
          <button className="mdk-btn mdk-btn-ghost" onClick={handleSurprise} disabled={surpriseBusy}>🎲 {surpriseBusy ? 'Выбираю…' : 'Сюрприз'}</button>
        </div>

        {genres.length > 0 && (
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
          <div className="text-center text-muted py-20 text-sm">Ничего не найдено по выбранным фильтрам</div>
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
        <h1 className="text-xl font-bold">Каталог</h1>
        <button
          onClick={handleSurprise}
          disabled={surpriseBusy}
          title="Случайный тайтл из «Смотрю»/«В планах»"
          className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-sm font-medium border border-accent/40 bg-accent/[0.10] text-accent hover:bg-accent/[0.18] transition-colors disabled:opacity-50"
        >
          🎲 {surpriseBusy ? 'Выбираю…' : 'Сюрприз'}
        </button>
      </div>

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
          <div className="flex items-center gap-2">
            <select value={yearFrom} onChange={e => setYearFrom(e.target.value ? Number(e.target.value) : '')}
              className="input !py-2 !px-2.5 text-sm flex-1">
              <option value="">от</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-muted">—</span>
            <select value={yearTo} onChange={e => setYearTo(e.target.value ? Number(e.target.value) : '')}
              className="input !py-2 !px-2.5 text-sm flex-1">
              <option value="">до</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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

      {loading && releases.length === 0 ? (
        <Spinner variant="grid" />
      ) : releases.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">Ничего не найдено по выбранным фильтрам</div>
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
