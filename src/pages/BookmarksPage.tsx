import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getHistory, getFavorites, getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import type { BookmarkItem } from '../api/bookmarks'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import type { Release } from '../api/releases'
import { useDesign } from '../lib/design'
import { getWatchProgress } from '../api/episodes'
import { img } from '../lib/img'
import { getMyRating, loadMyRatings, subscribeMyRatings } from '../lib/myRatings'
import { getShikiScore, requestShikiScore, subscribeShikiScores } from '../lib/shikiScores'

// "Рейтинг" сортирует по оценке Shikimori — она у нас на плитках и есть у
// большинства тайтлов, в отличие от оценки Anixart, которую мы почти нигде не
// показываем. "Моя оценка" — по личной десятибалльной, отдельно от общей.
const SORTS = [
  { label: 'По умолчанию', value: 'default' },
  { label: 'Название', value: 'title' },
  { label: 'Год', value: 'year' },
  { label: 'Рейтинг', value: 'grade' },
  { label: 'Моя оценка', value: 'my' },
] as const
type SortKey = typeof SORTS[number]['value']
type ViewMode = 'grid' | 'list'

function BookmarkRow({ r }: { r: Release }) {
  const [myRating, setMyRating] = useState(() => getMyRating(r.id))
  const orig = r.title_original || ''
  const [shiki, setShiki] = useState(() => getShikiScore(orig))
  useEffect(() => {
    const off1 = subscribeMyRatings(() => setMyRating(getMyRating(r.id)))
    const off2 = subscribeShikiScores(() => setShiki(getShikiScore(orig)))
    return () => { off1(); off2() }
  }, [r.id, orig])
  const progress = useMemo(() => getWatchProgress(r.id), [r.id])
  const poster = img(r.image || '')

  return (
    <Link
      to={`/release/${r.id}`}
      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition-colors text-left"
    >
      <div className="w-11 h-[62px] rounded-lg overflow-hidden bg-surface flex-shrink-0 border border-white/[0.06]">
        {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{r.title_ru}</div>
        <div className="text-xs text-muted truncate mt-0.5">
          {r.year || ''}
          {progress && <span className="text-accent-soft"> · Серия {progress.episodePosition}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {shiki > 0 && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-black/40 text-accent-soft">★{shiki.toFixed(2)}</span>
        )}
        {myRating > 0 && (
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-accent text-black">{myRating}/10</span>
        )}
      </div>
    </Link>
  )
}

const TABS = [
  { label: 'История', loader: (page: number) => getHistory(page) },
  { label: 'Избранное', loader: (page: number) => getFavorites(page) },
  { label: 'Смотрю', loader: (page: number) => getProfileList(1, page) },
  { label: 'В планах', loader: (page: number) => getProfileList(2, page) },
  { label: 'Просмотрено', loader: (page: number) => getProfileList(3, page) },
  { label: 'Отложено', loader: (page: number) => getProfileList(4, page) },
  { label: 'Брошено', loader: (page: number) => getProfileList(5, page) },
]

export default function BookmarksPage() {
  const design = useDesign()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (() => {
    const wanted = searchParams.get('tab')
    if (!wanted) return 0
    const i = TABS.findIndex(t => t.label === wanted)
    return i >= 0 ? i : 0
  })()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [items, setItems] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('default')
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('bookmarks_view') as ViewMode) || 'grid')
  useEffect(() => { localStorage.setItem('bookmarks_view', view) }, [view])

  // Личные оценки приходят одним запросом на всю сессию; оценки Shikimori —
  // пакетом по названиям. Оба кеша живут вне React, поэтому дёргаем ререндер
  // по подписке, когда данные для сортировки наконец доехали.
  const [ratingsTick, bumpRatings] = useState(0)
  useEffect(() => {
    const off1 = subscribeMyRatings(() => bumpRatings(n => n + 1))
    const off2 = subscribeShikiScores(() => bumpRatings(n => n + 1))
    void loadMyRatings()
    return () => { off1(); off2() }
  }, [])
  useEffect(() => {
    for (const r of items) requestShikiScore(r.title_original)
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? items.filter(r => [r.title_ru, r.title_en, r.title_original].some(t => t?.toLowerCase().includes(q)))
      : items
    if (sort !== 'default') {
      list = [...list].sort((a, b) => {
        if (sort === 'title') return (a.title_ru || '').localeCompare(b.title_ru || '')
        if (sort === 'year') return Number(b.year || 0) - Number(a.year || 0)
        if (sort === 'my') return getMyRating(b.id) - getMyRating(a.id)
        // Рейтинг — по Shikimori, не по Anixart: своей оценки у нас почти нигде не
        // показывается, а десятибалльная Shikimori есть у подавляющего большинства.
        return getShikiScore(b.title_original) - getShikiScore(a.title_original)
      })
    }
    return list
  }, [items, query, sort, ratingsTick])

  // React to ?tab= changes even when already mounted on this route — including
  // browser back/forward landing back on the bare (no ?tab=) URL, which must
  // restore the default "История" tab rather than leaving the last-active one.
  const tabParam = searchParams.get('tab')
  useEffect(() => {
    const i = tabParam ? TABS.findIndex(t => t.label === tabParam) : 0
    setActiveTab(i >= 0 ? i : 0)
  }, [tabParam])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setItems([])
    const loader = TABS[activeTab].loader
    ;(async () => {
      const all: BookmarkItem[] = []
      for (let page = 0; page < 40; page++) {
        let pageItems: BookmarkItem[]
        try {
          const data = await loader(page)
          pageItems = data.content || []
        } catch {
          break
        }
        all.push(...pageItems)
        if (pageItems.length < 20) break
      }
      if (!cancelled) {
        const releases = all.map(extractBookmarkRelease).filter(Boolean) as Release[]
        setItems(releases)
      }
    })().finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeTab])

  if (design === 'modern') {
    return (
      <div>
        <div className="mdk-rowhead" style={{ marginTop: 0 }}>
          <div>
            <h1 style={{ fontSize: 34 }}>Закладки</h1>
            {!loading && <div className="mdk-cs" style={{ marginTop: 4 }}>{items.length} тайтлов в списке</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => { setActiveTab(i); setSearchParams(i === 0 ? {} : { tab: tab.label }, { replace: true }) }}
              className={`mdk-chip ${activeTab === i ? 'mdk-chip-acc' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск в списке…"
              className="mdk-glass"
              style={{ padding: '9px 14px', fontSize: 13, color: '#f5f0ff', flex: '1 1 180px', maxWidth: 280, border: '1px solid rgba(255,255,255,.09)', outline: 0 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SORTS.map(s => (
                <button key={s.value} onClick={() => setSort(s.value)}
                  className={`mdk-chip ${sort === s.value ? 'mdk-chip-acc' : ''}`}>{s.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button onClick={() => setView('grid')} title="Сеткой"
                className={`mdk-chip ${view === 'grid' ? 'mdk-chip-acc' : ''}`}>▦</button>
              <button onClick={() => setView('list')} title="Списком"
                className={`mdk-chip ${view === 'list' ? 'mdk-chip-acc' : ''}`}>≡</button>
            </div>
          </div>
        )}

        {loading ? (
          <Spinner variant="grid" />
        ) : items.length === 0 ? (
          <div className="text-center text-muted py-20 text-sm">Список пуст</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted py-20 text-sm">Ничего не найдено</div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visible.map(r => <BookmarkRow key={r.id} r={r} />)}
          </div>
        ) : (
          <div className="mdk-grid">
            {visible.map(r => <ReleaseCard key={r.id} release={r} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold">Закладки</h1>
        {!loading && <span className="chip chip-active">{items.length}</span>}
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => { setActiveTab(i); setSearchParams(i === 0 ? {} : { tab: tab.label }, { replace: true }) }}
            className={`tab ${activeTab === i ? 'tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + sort */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск в списке…"
            className="input !py-2 text-sm flex-1 min-w-[180px] max-w-xs"
          />
          <div className="flex gap-1.5 flex-wrap">
            {SORTS.map(s => (
              <button key={s.value} onClick={() => setSort(s.value)}
                className={`chip ${sort === s.value ? 'chip-active' : ''}`}>{s.label}</button>
            ))}
          </div>
          <div className="flex gap-1.5 ml-auto">
            <button onClick={() => setView('grid')} title="Сеткой"
              className={`chip ${view === 'grid' ? 'chip-active' : ''}`}>▦</button>
            <button onClick={() => setView('list')} title="Списком"
              className={`chip ${view === 'list' ? 'chip-active' : ''}`}>≡</button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner variant="grid" />
      ) : items.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">Список пуст</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">Ничего не найдено</div>
      ) : view === 'list' ? (
        <div className="flex flex-col gap-0.5">
          {visible.map(r => <BookmarkRow key={r.id} r={r} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {visible.map(r => (
            <ReleaseCard key={r.id} release={r} />
          ))}
        </div>
      )}
    </div>
  )
}
