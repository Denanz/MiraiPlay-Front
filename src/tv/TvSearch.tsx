import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchReleases, getFilter, extractReleases, type Release } from '../api/releases'
import { TvCard } from './parts'
import { TvRow, TvScroller, useInitialFocus } from './focus'

// Своя клавиатура вместо системной: печатать пультом по сетке быстрее и
// предсказуемее, чем через IME телевизора. Состояние запроса переживает уход
// на карточку тайтла и возврат назад.
const LAYOUTS: Record<'ru' | 'en' | 'num', string[]> = {
  ru: ['абвгде', 'ёжзийк', 'лмнопр', 'стуфхц', 'чшщъыь', 'эюя'],
  en: ['abcdef', 'ghijkl', 'mnopqr', 'stuvwx', 'yz'],
  num: ['123456', '7890-!', '?.,:()'],
}
const PER_ROW = 5

let savedQuery = ''

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export default function TvSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState(savedQuery)
  const [layout, setLayout] = useState<'ru' | 'en' | 'num'>('ru')
  const [results, setResults] = useState<Release[] | null>(null)
  const [popular, setPopular] = useState<Release[]>([])

  useEffect(() => { savedQuery = query }, [query])

  useEffect(() => {
    getFilter(0, { sort: 1, genres: [], is_genres_exclude_mode_enabled: false, extended_mode: true })
      .then((d) => setPopular(extractReleases(d).slice(0, 20)))
      .catch(() => setPopular([]))
  }, [])

  // Поиск с задержкой: пока пользователь «печатает», запросы не шлём.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); return }
    let cancelled = false
    const t = setTimeout(() => {
      searchReleases(q)
        .then((d) => { if (!cancelled) setResults(extractReleases(d)) })
        .catch(() => { if (!cancelled) setResults([]) })
    }, 450)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  useInitialFocus(true)

  const list = results || popular
  const heading = results
    ? (results.length ? `Найдено: ${results.length}` : 'Ничего не найдено')
    : (query.trim().length === 1 ? 'Продолжай печатать…' : 'Популярное')

  const key = (label: string, onPress: () => void, extra = '', tvKey?: string) => (
    <button className={`tvk-key ${extra}`} data-tv-key={tvKey || `k:${label}`} onClick={onPress}>{label}</button>
  )

  return (
    <>
      <div className="tvk">
        <div className="tvk-query">
          {query ? query : <span className="ph">Название аниме</span>}
          <span className="tvk-caret" />
        </div>
        {LAYOUTS[layout].map((row, i) => (
          <div className="tvk-row" key={`${layout}${i}`}>
            {row.split('').map((ch) => (
              <button key={ch} className="tvk-key" data-tv-key={`k:${ch}`}
                {...(layout === 'ru' && ch === 'а' ? { 'data-tv-autofocus': true } : {})}
                onClick={() => setQuery((q) => q + ch)}>
                {ch.toUpperCase()}
              </button>
            ))}
          </div>
        ))}
        <div className="tvk-row">
          {key('Пробел', () => setQuery((q) => (q && !q.endsWith(' ') ? q + ' ' : q)), 'wide', 'k:space')}
          {key('⌫', () => setQuery((q) => q.slice(0, -1)), '', 'k:bs')}
          {key('Очистить', () => setQuery(''), 'wide', 'k:clear')}
        </div>
        <div className="tvk-row">
          {key('РУС', () => setLayout('ru'), `wide${layout === 'ru' ? ' on' : ''}`, 'k:ru')}
          {key('ENG', () => setLayout('en'), `wide${layout === 'en' ? ' on' : ''}`, 'k:en')}
          {key('123', () => setLayout('num'), `${layout === 'num' ? 'on' : ''}`, 'k:num')}
        </div>
      </div>

      <div className="tvk-results">
        <div className="tvk-head">{heading}</div>
        <TvScroller top={64} offset={0}>
          {chunk(list, PER_ROW).map((row, i) => (
            <TvRow key={i} id={`res${i}`} fixed>
              {row.map((r) => (
                <TvCard key={r.id} tvKey={`res:${r.id}`} release={r} onPick={() => navigate(`/release/${r.id}`)} />
              ))}
            </TvRow>
          ))}
        </TvScroller>
      </div>
    </>
  )
}
