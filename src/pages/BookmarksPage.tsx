import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getHistory, getFavorites, getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import type { BookmarkItem } from '../api/bookmarks'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import type { Release } from '../api/releases'
import { hasGrade } from '../api/releases'
import { useDesign } from '../lib/design'

const SORTS = [
  { label: 'По умолчанию', value: 'default' },
  { label: 'Название', value: 'title' },
  { label: 'Год', value: 'year' },
  { label: 'Рейтинг', value: 'grade' },
] as const
type SortKey = typeof SORTS[number]['value']

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? items.filter(r => [r.title_ru, r.title_en, r.title_original].some(t => t?.toLowerCase().includes(q)))
      : items
    if (sort !== 'default') {
      list = [...list].sort((a, b) => {
        if (sort === 'title') return (a.title_ru || '').localeCompare(b.title_ru || '')
        if (sort === 'year') return Number(b.year || 0) - Number(a.year || 0)
        // Unrated titles carry a placeholder grade (e.g. 5.00 with 0 votes) —
        // treat them as 0 so they sink below genuinely-rated titles instead of
        // sorting as if they had a real ~5.0 community score.
        return (hasGrade(b) ? b.grade! : 0) - (hasGrade(a) ? a.grade! : 0)
      })
    }
    return list
  }, [items, query, sort])

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
          </div>
        )}

        {loading ? (
          <Spinner variant="grid" />
        ) : items.length === 0 ? (
          <div className="text-center text-muted py-20 text-sm">Список пуст</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-muted py-20 text-sm">Ничего не найдено</div>
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
        </div>
      )}

      {loading ? (
        <Spinner variant="grid" />
      ) : items.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">Список пуст</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-muted py-20 text-sm">Ничего не найдено</div>
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
