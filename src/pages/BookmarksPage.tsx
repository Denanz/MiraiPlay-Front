import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getHistory, getFavorites, getProfileList, extractBookmarkRelease } from '../api/bookmarks'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import type { Release } from '../api/releases'
import { useDesign } from '../lib/design'

const SORTS = [
  { label: 'По умолчанию', value: 'default' },
  { label: 'Название', value: 'title' },
  { label: 'Год', value: 'year' },
  { label: 'Рейтинг', value: 'grade' },
] as const
type SortKey = typeof SORTS[number]['value']

const TABS = [
  { label: 'История', loader: () => getHistory() },
  { label: 'Избранное', loader: () => getFavorites() },
  { label: 'Смотрю', loader: () => getProfileList(1) },
  { label: 'В планах', loader: () => getProfileList(2) },
  { label: 'Просмотрено', loader: () => getProfileList(3) },
  { label: 'Отложено', loader: () => getProfileList(4) },
  { label: 'Брошено', loader: () => getProfileList(5) },
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
        return (b.grade || 0) - (a.grade || 0)
      })
    }
    return list
  }, [items, query, sort])

  // React to ?tab= changes even when already mounted on this route.
  const tabParam = searchParams.get('tab')
  useEffect(() => {
    if (!tabParam) return
    const i = TABS.findIndex(t => t.label === tabParam)
    if (i >= 0) setActiveTab(i)
  }, [tabParam])

  useEffect(() => {
    setLoading(true)
    setItems([])
    TABS[activeTab].loader()
      .then(data => {
        const rawItems = data.content || []
        const releases = rawItems.map(extractBookmarkRelease).filter(Boolean) as Release[]
        setItems(releases)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
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
