import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listWatchProgress, removeWatchProgress, saveWatchProgress,
  getAccountContinueWatching, deleteAccountHistory, type WatchProgressEntry,
} from '../api/episodes'
import { getRelease } from '../api/releases'
import { getContinueWatching, watchedPct, fmtTime } from '../api/progress'
import { resumeWatch } from '../lib/resume'
import { img } from '../lib/img'

export default function ContinueWatching() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WatchProgressEntry[]>(() => listWatchProgress())
  const [fromAccount, setFromAccount] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // releaseId → exact within-episode position (seconds), from the MiraiHub gateway.
  const [secMap, setSecMap] = useState<Map<string, { position: number; duration: number }>>(new Map())

  // Prefer the Anixart account history (cross-device); fall back to localStorage.
  useEffect(() => {
    let cancelled = false
    const loggedIn = !!localStorage.getItem('anixart_token')

    const useLocalWithBackfill = () => {
      const local = listWatchProgress()
      const missing = local.filter((e) => !e.releaseImage || !e.releaseTitle)
      if (missing.length === 0) return
      Promise.all(missing.map(async (entry) => {
        try {
          const data = await getRelease(entry.releaseId)
          const r = data.release
            || (Array.isArray(data.content) ? data.content[0] : data.content?.content?.[0])
            || null
          if (!r) return
          saveWatchProgress({
            ...entry,
            releaseTitle: entry.releaseTitle || r.title_ru,
            releaseImage: entry.releaseImage || r.image,
            episodesTotal: entry.episodesTotal ?? r.episodes_total,
            episodesReleased: entry.episodesReleased ?? r.episodes_released,
          })
        } catch { /* ignore */ }
      })).then(() => { if (!cancelled) setItems(listWatchProgress()) })
    }

    if (loggedIn) {
      getAccountContinueWatching()
        .then((account) => {
          if (cancelled) return
          if (account.length > 0) { setItems(account); setFromAccount(true) }
          else useLocalWithBackfill()
        })
        .catch(() => { if (!cancelled) useLocalWithBackfill() })
    } else {
      useLocalWithBackfill()
    }

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fine-grained within-episode position (seconds) for the progress overlay.
  useEffect(() => {
    let cancelled = false
    getContinueWatching().then((list) => {
      if (cancelled) return
      const map = new Map<string, { position: number; duration: number }>()
      for (const it of list) {
        // List is newest-first; keep the most recent entry per release.
        if (!map.has(it.releaseId)) map.set(it.releaseId, { position: it.position, duration: it.duration })
      }
      setSecMap(map)
    })
    return () => { cancelled = true }
  }, [])


  if (items.length === 0) return null

  const remove = (e: React.MouseEvent, releaseId: string) => {
    e.preventDefault()
    e.stopPropagation()
    removeWatchProgress(releaseId)
    if (fromAccount) {
      deleteAccountHistory(releaseId).catch(() => {})
      setItems((prev) => prev.filter((it) => it.releaseId !== releaseId))
    } else {
      setItems(listWatchProgress())
    }
  }

  const resume = async (entry: WatchProgressEntry) => {
    setBusy(entry.releaseId)
    try {
      await resumeWatch(navigate, entry)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Продолжить смотреть</h2>
        {items.length > 4 && (
          <span className="text-xs text-muted/60">{items.length}</span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((entry) => {
          const sec = secMap.get(entry.releaseId)
          const secPct = sec ? watchedPct(sec.position, sec.duration) : 0
          return (
          <Link
            key={entry.releaseId}
            to={`/release/${entry.releaseId}`}
            onClick={(e) => { if (busy === entry.releaseId) e.preventDefault() }}
            className={`group relative shrink-0 w-24 sm:w-28 snap-start text-left focus:outline-none ${
              busy === entry.releaseId ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-white/[0.06]
                            transition-all duration-200 group-hover:border-accent/40">
              {entry.releaseImage ? (
                <img src={img(entry.releaseImage)} alt={entry.releaseTitle || ''} loading="lazy"
                     className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted/70 px-2 text-center bg-gradient-to-br from-elevated to-surface">
                  {entry.releaseTitle || 'Без названия'}
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

              {/* play overlay — resumes playback; the card itself opens release info */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); resume(entry) }}
                  aria-label="Продолжить просмотр"
                  className="w-11 h-11 rounded-full bg-accent/90 text-[#130d1c] flex items-center justify-center text-lg shadow-lg"
                >
                  ▶
                </button>
              </div>

              <span className="absolute left-1.5 bottom-1.5 max-w-[calc(100%-0.75rem)] truncate px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/65 text-white">
                Серия {entry.episodePosition}{entry.episodesTotal ? `/${entry.episodesTotal}` : ''}
                {secPct > 0 && <span className="ml-1 font-normal text-accent-soft">▸ {fmtTime(sec!.position)}</span>}
              </span>

              {/* New-episodes badge */}
              {entry.episodesReleased != null && entry.episodesReleased > entry.episodePosition && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-accent text-[#130d1c]">
                  +{entry.episodesReleased - entry.episodePosition}
                </span>
              )}

              {/* Progress bar: prefer exact within-episode position, else episode/total */}
              {secPct > 0 ? (
                <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/40">
                  <div className="h-full bg-accent" style={{ width: `${secPct}%` }} />
                </div>
              ) : entry.episodesTotal ? (
                <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/40">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, (entry.episodePosition / entry.episodesTotal) * 100)}%` }} />
                </div>
              ) : null}

              <span
                onClick={(e) => remove(e, entry.releaseId)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white/80 text-xs
                           flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                           hover:bg-red-500/70 hover:text-white"
                title="Убрать из списка"
                role="button"
                aria-label="Убрать"
              >
                ✕
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-text/85 line-clamp-1 leading-snug">{entry.releaseTitle || 'Без названия'}</p>
          </Link>
          )
        })}
      </div>
    </section>
  )
}
