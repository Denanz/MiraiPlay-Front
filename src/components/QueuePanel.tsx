import { useEffect, useState } from 'react'
import { searchReleases, extractReleases, type Release } from '../api/releases'
import { getDubbers, getSources, getEpisodes, getEpisodeTarget } from '../api/episodes'
import type { EpisodeType, EpisodeSource, Episode } from '../api/episodes'
import type { WtContent } from '../api/together'

interface Props {
  queue: WtContent[]
  onAdd: (item: WtContent) => void
  onRemove: (index: number) => void
  onPlayNow: (index: number) => void
  onClose: () => void
}

export default function QueuePanel({ queue, onAdd, onRemove, onPlayNow, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Release[]>([])
  const [searching, setSearching] = useState(false)

  const [picked, setPicked] = useState<Release | null>(null)
  const [types, setTypes] = useState<EpisodeType[]>([])
  const [sources, setSources] = useState<EpisodeSource[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selType, setSelType] = useState<EpisodeType | null>(null)
  const [selSource, setSelSource] = useState<EpisodeSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(0)
  const [err, setErr] = useState('')

  // Search (debounced)
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try { setResults(extractReleases(await searchReleases(query.trim())).slice(0, 12)) }
      catch { setResults([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  const pickRelease = async (r: Release) => {
    setPicked(r); setErr(''); setLoading(true)
    setTypes([]); setSources([]); setEpisodes([]); setSelType(null); setSelSource(null)
    try {
      const d = await getDubbers(r.id)
      const t = d.types ?? []
      setTypes(t)
      if (t[0]) await pickType(r.id, t[0])
    } catch { setErr('Не удалось загрузить озвучки') }
    finally { setLoading(false) }
  }

  const pickType = async (releaseId: string | number, t: EpisodeType) => {
    setSelType(t); setSources([]); setEpisodes([]); setSelSource(null); setLoading(true)
    try {
      const d = await getSources(releaseId, t.id)
      const s = d.sources ?? []
      setSources(s)
      if (s[0]) await pickSource(releaseId, t.id, s[0])
    } catch { setErr('Не удалось загрузить источники') }
    finally { setLoading(false) }
  }

  const pickSource = async (releaseId: string | number, typeId: number, s: EpisodeSource) => {
    setSelSource(s); setEpisodes([]); setLoading(true)
    try {
      const d = await getEpisodes(releaseId, typeId, s.id)
      let eps = d.episodes ?? []
      if (!eps.length && s.episodes_count) {
        eps = Array.from({ length: s.episodes_count }, (_, i) => ({ position: i + 1 }))
      }
      setEpisodes(eps)
    } catch { setErr('Не удалось загрузить серии') }
    finally { setLoading(false) }
  }

  const addEpisode = async (ep: Episode) => {
    if (!picked || !selSource) return
    setAdding(ep.position); setErr('')
    try {
      const data = await getEpisodeTarget(picked.id, selSource.id, ep.position)
      const raw = data.episode?.url || ''
      if (!raw) { setErr('Серия недоступна'); return }
      const kodikUrl = raw.startsWith('//') ? `https:${raw}` : raw
      const total = episodes.length ? Math.max(...episodes.map(e => e.position)) : (selSource.episodes_count || 0)
      onAdd({
        releaseId: String(picked.id), sourceId: selSource.id, position: ep.position,
        episodeName: ep.name || `Эпизод ${ep.position}`, releaseName: picked.title_ru,
        dubberName: selType?.name, sourceName: selSource.name, totalEpisodes: total, kodikUrl,
      })
    } catch { setErr('Ошибка добавления') }
    finally { setAdding(0) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-[#0e0b16] border-l border-white/10 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="font-display text-lg">Очередь</div>
          <span className="text-xs text-muted">{queue.length} в очереди</span>
          <button onClick={onClose} className="btn-ghost ml-auto !py-1 !px-2">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Current queue */}
          {queue.length > 0 && (
            <div className="space-y-2">
              {queue.map((q, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] text-sm">
                  <span className="text-muted shrink-0">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{q.releaseName || q.releaseId}</div>
                    <div className="text-xs text-muted truncate">{[q.dubberName, q.sourceName, `серия ${q.position}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button onClick={() => onPlayNow(i)} className="btn-ghost shrink-0 !py-1 !px-2" title="Включить сейчас">▶</button>
                  <button onClick={() => onRemove(i)} className="btn-ghost shrink-0 !py-1 !px-2" title="Убрать">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Search / add */}
          {!picked ? (
            <div className="space-y-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Найти аниме для добавления…"
                className="input w-full"
                autoFocus
              />
              {searching && <div className="text-xs text-muted">Поиск…</div>}
              <div className="space-y-1">
                {results.map(r => (
                  <button key={r.id} onClick={() => pickRelease(r)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/[0.06] text-left">
                    {r.image && <img src={r.image} alt="" className="w-10 h-14 object-cover rounded shrink-0" />}
                    <span className="text-sm line-clamp-2">{r.title_ru}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={() => setPicked(null)} className="btn-ghost !py-1 !px-2 text-xs">← К поиску</button>
              <div className="font-medium text-sm">{picked.title_ru}</div>
              {err && <div className="text-xs text-red-400">{err}</div>}

              {types.length > 0 && (
                <div>
                  <div className="text-xs text-muted mb-1">Озвучка</div>
                  <div className="flex flex-wrap gap-1">
                    {types.map(t => (
                      <button key={t.id} onClick={() => pickType(picked.id, t)}
                        className={`px-2 py-1 rounded text-xs ${selType?.id === t.id ? 'bg-accent text-black' : 'bg-white/[0.06]'}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sources.length > 0 && (
                <div>
                  <div className="text-xs text-muted mb-1">Источник</div>
                  <div className="flex flex-wrap gap-1">
                    {sources.map(s => (
                      <button key={s.id} onClick={() => pickSource(picked.id, selType!.id, s)}
                        className={`px-2 py-1 rounded text-xs ${selSource?.id === s.id ? 'bg-accent text-black' : 'bg-white/[0.06]'}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && <div className="text-xs text-muted">Загрузка…</div>}

              {episodes.length > 0 && (
                <div>
                  <div className="text-xs text-muted mb-1">Серия (нажми, чтобы добавить)</div>
                  <div className="grid grid-cols-6 gap-1">
                    {episodes.map(ep => (
                      <button key={ep.position} onClick={() => addEpisode(ep)} disabled={adding === ep.position}
                        className="aspect-square rounded bg-white/[0.06] hover:bg-accent hover:text-black text-xs disabled:opacity-50">
                        {adding === ep.position ? '…' : ep.position}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
