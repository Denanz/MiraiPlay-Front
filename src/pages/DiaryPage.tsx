import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDiary, type DiaryListItem } from '../api/diary'
import { img } from '../lib/img'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'

// Два списка вместо обрезки окончаний: «мая» → «май», а не «маь».
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** Заголовок группы — «Июль 2026». Записи без даты сваливаем в конец. */
function monthKey(ts: number): string {
  if (!ts) return 'Без даты'
  const d = new Date(ts)
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`
}

function dayLabel(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}

/** 1 запись, 2–4 записи, 5+ записей — включая 11–14, которые ведут себя как 5+. */
function pluralEntries(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return `${n} записей`
  if (mod10 === 1) return `${n} запись`
  if (mod10 >= 2 && mod10 <= 4) return `${n} записи`
  return `${n} записей`
}

type RatingFilter = 'all' | 'high' | 'rated'

export default function DiaryPage() {
  const navigate = useNavigate()
  const design = useDesign()
  const [entries, setEntries] = useState<DiaryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RatingFilter>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await listDiary()
      if (!cancelled) { setEntries(list); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (filter === 'high' && e.rating < 8) return false
      if (filter === 'rated' && !e.rating) return false
      if (!q) return true
      return (e.text || '').toLowerCase().includes(q) || (e.title || '').toLowerCase().includes(q)
    })
  }, [entries, query, filter])

  // Группируем по месяцам, сохраняя порядок «свежие сверху», который пришёл с сервера.
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: DiaryListItem[] }> = []
    for (const e of visible) {
      const label = monthKey(e.updatedAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(e)
      else out.push({ label, items: [e] })
    }
    return out
  }, [visible])

  if (loading) return <Spinner />

  if (entries.length === 0) {
    return (
      <section className="mb-6">
        <h1 className="font-display text-2xl mb-2">Дневник</h1>
        <p className="text-sm text-muted">
          Пока пусто. Записи о просмотренном пишутся на странице тайтла — пара строк
          и своя оценка, — а сюда они собираются в хронологическую ленту.
        </p>
      </section>
    )
  }

  const chip = (value: RatingFilter, label: string) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
        filter === value ? 'bg-accent text-black' : 'bg-white/[0.06] text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className="mb-6">
      <div className="flex items-baseline gap-3 mb-3">
        <h1 className={design === 'modern' ? 'mdk-title' : 'font-display text-2xl'}>Дневник</h1>
        <span className="text-xs text-muted">{pluralEntries(entries.length)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по тексту и названию…"
          className="input flex-1 min-w-[200px]"
        />
        {chip('all', 'Все')}
        {chip('rated', 'С оценкой')}
        {chip('high', '8 и выше')}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted">Ничего не нашлось.</p>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mb-7">
          <h2 className="text-xs uppercase tracking-wide text-muted mb-3">{g.label}</h2>
          <div className="space-y-3">
            {g.items.map((e) => (
              <article
                key={e.releaseId}
                onClick={() => navigate(`/release/${e.releaseId}`)}
                className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/40 transition-colors cursor-pointer"
              >
                <div className="w-14 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-white/[0.05]">
                  {e.image && (
                    <img src={img(e.image)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium truncate">
                      {e.title || `Тайтл #${e.releaseId}`}
                    </h3>
                    {e.rating > 0 && (
                      <span className="shrink-0 text-xs text-accent font-semibold">{e.rating}/10</span>
                    )}
                    <span className="shrink-0 ml-auto text-[11px] text-muted">{dayLabel(e.updatedAt)}</span>
                  </div>
                  {e.text && (
                    <p className="text-sm text-text/80 mt-1 whitespace-pre-line line-clamp-6">{e.text}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
