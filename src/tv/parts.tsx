import { useEffect, useState, type ReactNode } from 'react'
import { getRelease, hasGrade, type Release } from '../api/releases'
import { img } from '../lib/img'

/** Постер через свой прокси, сразу уменьшенный: у ТВ мало памяти под картинки. */
export function tvImg(url?: string, width = 320): string {
  const u = img(url)
  return u && u.indexOf('/api/v1/img?') !== -1 ? `${u}&w=${width}` : u
}

export const Icon = {
  search: <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>,
  lists: <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" /></svg>,
  settings: <svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58a7.4 7.4 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7.4 7.4 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" /></svg>,
  play: <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  info: <svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>,
  heart: <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>,
  list: <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" /></svg>,
}

/** Карточка-постер. Фокус — увеличение и акцентная рамка (tv.css). */
export function TvCard({ release, onPick, onFocusItem, tvKey, badge, progress }: {
  release: Pick<Release, 'id' | 'title_ru' | 'image' | 'grade' | 'vote_count'>
  onPick: () => void
  onFocusItem?: () => void
  tvKey: string
  badge?: ReactNode
  progress?: number
}) {
  const poster = tvImg(release.image)
  return (
    <button className="tvc" data-tv-item data-tv-key={tvKey} onClick={onPick} onFocus={onFocusItem}>
      <div className="tvc-noimg">{release.title_ru}</div>
      {poster && <img src={poster} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
      {hasGrade(release as Release) && <span className="tvc-grade">★ {release.grade!.toFixed(1)}</span>}
      {badge && <span className="tvc-badge">{badge}</span>}
      {progress !== undefined && progress > 0 && (
        <div className="tvc-progress"><div style={{ width: `${Math.min(100, progress)}%` }} /></div>
      )}
    </button>
  )
}

export function SkeletonRow({ count = 7 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <div key={i} className="tvc skeleton" />)}</>
}

export function Spinner() {
  return <div className="tv-center"><div className="tv-spinner" /></div>
}

export function metaLine(r: Release): ReactNode[] {
  const out: ReactNode[] = []
  if (hasGrade(r)) out.push(<span key="g" className="tv-grade">★ {r.grade!.toFixed(1)}</span>)
  if (r.year) out.push(<span key="y">{r.year}</span>)
  if (r.status && r.status.name) out.push(<span key="s" className="tv-pill">{r.status.name}</span>)
  const eps = r.episodes_released || r.episodes_total
  if (eps) out.push(<span key="e">{r.episodes_total && r.episodes_released !== r.episodes_total ? `${r.episodes_released || 0} из ${r.episodes_total} эп.` : `${eps} эп.`}</span>)
  const genres = (r.genres || '').split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3)
  if (genres.length) out.push(<span key="gn">{genres.join(' · ')}</span>)
  return out
}

/**
 * Подробности для баннера: у карточек из выдачи нет кадров, их берём из полной
 * карточки релиза (она кэшируется). Запрос — с задержкой, чтобы быстрое
 * пролистывание пультом не дёргало сеть на каждой карточке.
 */
export function useReleaseDetails(release: Release | null, delay = 450): Release | null {
  const [full, setFull] = useState<Release | null>(null)
  useEffect(() => {
    setFull(null)
    if (!release) return
    let cancelled = false
    const t = setTimeout(() => {
      getRelease(release.id)
        .then((d) => {
          const r = d.release || (Array.isArray(d.content) ? d.content[0] : d.content && d.content.content && d.content.content[0])
          if (!cancelled && r) setFull(r as Release)
        })
        .catch(() => { /* останется краткая версия */ })
    }, delay)
    return () => { cancelled = true; clearTimeout(t) }
  }, [release && release.id])
  return full && release && full.id === release.id ? full : null
}

/** Большой баннер с фоном, названием и описанием тайтла. */
export function Billboard({ release, kicker, children, height }: {
  release: Release | null
  kicker?: ReactNode
  children?: ReactNode
  height?: number
}) {
  const full = useReleaseDetails(release)
  const r = full || release
  if (!r) return <div className="tvb" style={height ? { height } : undefined} />
  const shot = full && full.screenshot_images && full.screenshot_images[0]
  const bg = shot ? tvImg(shot, 1280) : tvImg(r.image, 900)
  return (
    <div className="tvb" style={height ? { height } : undefined}>
      {bg && <div key={bg} className={`tvb-bg${shot ? '' : ' poster'}`} style={{ backgroundImage: `url("${bg}")` }} />}
      <div className="tvb-shade" />
      <div className="tvb-info" key={r.id}>
        {kicker && <div className="tv-kicker">{kicker}</div>}
        <h1 className="tv-title">{r.title_ru}</h1>
        <div className="tv-meta">{metaLine(r)}</div>
        {r.description && <p className="tv-desc">{r.description}</p>}
        {children}
      </div>
    </div>
  )
}
