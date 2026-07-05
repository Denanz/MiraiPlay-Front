import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchReleases, extractReleases } from '../api/releases'
import type { Release } from '../api/releases'
import ReleaseCard from '../components/ReleaseCard'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import '../styles/modern-search.css'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [results, setResults] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const data = await searchReleases(value.trim())
      const items: Release[] = extractReleases(data)
      setResults(items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialQuery = params.get('q') || ''
    if (!initialQuery.trim()) return
    setQuery(initialQuery)
    runSearch(initialQuery)
  }, [params])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setParams({ q: query.trim() })
    runSearch(query.trim())
  }

  const design = useDesign()

  if (design === 'modern') {
    return (
      <div>
        <div className="mdk-rowhead" style={{ margin: '0 0 22px' }}>
          <h1 className="text-2xl font-semibold" style={{ textTransform: 'none', letterSpacing: 0, color: '#f5f0ff', fontSize: 28 }}>Поиск</h1>
        </div>

        <form onSubmit={handleSearch} className="mdk-glass mdp-search-bar mb-8">
          <svg viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5" /></svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Название, жанр или студия…"
            autoFocus
          />
          <button type="submit" disabled={loading} className="mdk-btn mdk-btn-primary">Найти</button>
        </form>

        {loading ? (
          <Spinner variant="grid" />
        ) : searched && results.length === 0 ? (
          <p className="text-center text-muted py-20 text-sm">Ничего не найдено</p>
        ) : results.length > 0 ? (
          <>
            <div className="mdk-rowhead">
              <h2>Результаты · <b>«{query}»</b></h2>
            </div>
            <div className="mdp-search-results-grid">
              {results.map(r => (
                <ReleaseCard key={r.id} release={r} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Поиск</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-2xl">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Название, жанр или студия…"
            autoFocus
            className="input pl-10"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          Найти
        </button>
      </form>

      {loading ? (
        <Spinner variant="grid" />
      ) : searched && results.length === 0 ? (
        <p className="text-center text-muted py-20 text-sm">Ничего не найдено</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {results.map(r => (
            <ReleaseCard key={r.id} release={r} />
          ))}
        </div>
      )}
    </div>
  )
}
