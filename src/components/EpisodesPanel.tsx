import { useEffect, useRef, useState } from 'react'
import {
  getDubbers,
  getEpisodes,
  getSources,
  getWatchSelection,
  invalidateEpisodes,
  markWatched,
  unmarkWatched,
  type Episode,
} from '../api/episodes'

interface Props {
  releaseId: string
  /** Нужен, чтобы получить настоящие названия серий. Если его нет — резолвим по sourceId. */
  typeId?: number
  sourceId: number
  position: number
  totalEpisodes?: number
  /** Гость в комнате не управляет воспроизведением — список только для чтения. */
  readOnly?: boolean
  onPick: (position: number) => void
  onClose: () => void
}

export default function EpisodesPanel({
  releaseId, typeId, sourceId, position, totalEpisodes, readOnly, onPick, onClose,
}: Props) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [watched, setWatched] = useState<Set<number>>(new Set())
  const [resolvedTypeId, setResolvedTypeId] = useState<number | undefined>()
  const [busy, setBusy] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const currentRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    const fallback = () => {
      const n = totalEpisodes || 0
      return n > 0 ? Array.from({ length: n }, (_, i) => ({ position: i + 1 }) as Episode) : []
    }

    // typeId приходит не всегда: со страницы тайтла — да, а из «Продолжить
    // просмотр» и у гостя комнаты его может не быть вовсе. Достаём по порядку:
    // из состояния → из сохранённого выбора → и, как последняя попытка, ищем
    // озвучку, среди источников которой есть наш sourceId. Без него панель
    // осталась бы пустой, потому что totalEpisodes там тоже не передаётся.
    const resolveTypeId = async (): Promise<number | undefined> => {
      if (typeId) return typeId
      const saved = getWatchSelection(releaseId)?.typeId
      if (saved) return saved
      try {
        const types = (await getDubbers(releaseId)).types ?? []
        const hits = await Promise.all(
          types.map(async (t) => {
            try {
              const s = await getSources(releaseId, t.id)
              return (s.sources ?? []).some((x) => x.id === sourceId) ? t.id : null
            } catch { return null }
          }),
        )
        return hits.find((x): x is number => x != null)
      } catch { return undefined }
    }

    ;(async () => {
      setLoading(true); setErr('')
      try {
        const tid = await resolveTypeId()
        if (cancelled) return
        setResolvedTypeId(tid)
        const eps = tid ? ((await getEpisodes(releaseId, tid, sourceId)).episodes ?? []) : []
        if (cancelled) return
        const list = eps.length ? eps : fallback()
        setEpisodes(list)
        setWatched(new Set(list.filter((e) => e.is_watched).map((e) => e.position)))
        if (!list.length) setErr('Не удалось загрузить список серий')
      } catch {
        if (cancelled) return
        const fb = fallback()
        setEpisodes(fb)
        // Номера показать смогли — это не ошибка, просто без названий.
        if (!fb.length) setErr('Не удалось загрузить список серий')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [releaseId, typeId, sourceId, totalEpisodes])

  // Держим текущую серию в поле зрения при открытии панели.
  useEffect(() => {
    if (!loading) currentRef.current?.scrollIntoView({ block: 'center' })
  }, [loading])

  // Отметку ставим сразу, не дожидаясь сервера — иначе тычок в галочку кажется
  // залипшим. Если запрос упал, возвращаем как было и говорим об этом.
  const toggleWatched = async (pos: number) => {
    if (readOnly || busy !== null) return
    const was = watched.has(pos)
    setBusy(pos); setErr('')
    setWatched((prev) => {
      const next = new Set(prev)
      if (was) next.delete(pos); else next.add(pos)
      return next
    })
    try {
      if (was) await unmarkWatched(releaseId, sourceId, pos)
      else await markWatched(releaseId, sourceId, pos)
      // Список серий кеширован — сбрасываем, чтобы при следующем открытии
      // панель не показала прежнее значение is_watched.
      if (resolvedTypeId) invalidateEpisodes(releaseId, resolvedTypeId, sourceId)
    } catch {
      setWatched((prev) => {
        const next = new Set(prev)
        if (was) next.add(pos); else next.delete(pos)
        return next
      })
      setErr('Не удалось изменить отметку')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-[#0e0b16] border-l border-white/10 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="font-display text-lg">Серии</div>
          {episodes.length > 0 && (
            <span className="text-xs text-muted">{watched.size} из {episodes.length}</span>
          )}
          <button onClick={onClose} className="btn-ghost ml-auto !py-1 !px-2">✕</button>
        </div>

        {err && <div className="text-xs text-red-400 px-4 py-2 shrink-0">{err}</div>}

        <div className="overflow-y-auto flex-1 p-2">
          {loading && <div className="text-sm text-muted p-3">Загрузка…</div>}
          {!loading && episodes.length === 0 && !err && (
            <div className="text-sm text-muted p-3">Список серий пуст</div>
          )}

          {episodes.map(ep => {
            const active = ep.position === position
            const seen = watched.has(ep.position)
            return (
              <div
                key={ep.position}
                className={`flex items-center gap-1 rounded-lg ${
                  active ? 'bg-accent/15 border border-accent/40' : 'border border-transparent'
                }`}
              >
                <button
                  ref={active ? currentRef : undefined}
                  disabled={readOnly || active}
                  onClick={() => onPick(ep.position)}
                  className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    active || readOnly ? '' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 text-center text-sm font-semibold tabular-nums ${
                      active ? 'text-accent' : seen ? 'text-muted/60' : 'text-muted'
                    }`}
                  >
                    {ep.position}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm truncate ${seen && !active ? 'text-text/50' : ''}`}>
                    {ep.name || `Эпизод ${ep.position}`}
                  </span>
                  {active && <span className="shrink-0 text-[11px] text-accent">сейчас</span>}
                </button>

                {!readOnly && (
                  <button
                    onClick={() => toggleWatched(ep.position)}
                    disabled={busy === ep.position}
                    title={seen ? 'Отметить как непросмотренную' : 'Отметить как просмотренную'}
                    aria-label={seen ? 'Отметить как непросмотренную' : 'Отметить как просмотренную'}
                    className={`shrink-0 w-9 h-9 mr-1 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                      seen ? 'text-accent hover:bg-accent/15' : 'text-muted/50 hover:text-text hover:bg-white/[0.06]'
                    }`}
                  >
                    {seen ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
