import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFilter, extractReleases, hasGrade } from '../api/releases'
import type { Release } from '../api/releases'
import { img } from '../lib/img'
import { useDesign } from '../lib/design'

// Featured spotlight: most popular candidate that's actually watchable right now
// (skip "Анонс" — status.id 3 — since there are no episodes to watch yet).
// Note: release.status_id is always 0 (dead field) — the real status is nested.
export default function Spotlight() {
  const navigate = useNavigate()
  const design = useDesign()
  const [candidates, setCandidates] = useState<Release[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getFilter(0, { sort: 1, extended_mode: true, genres: [], is_genres_exclude_mode_enabled: false })
      .then((d) => { if (!cancelled) setCandidates(extractReleases(d)) })
      .catch(() => { if (!cancelled) setCandidates([]) })
    return () => { cancelled = true }
  }, [])

  const hero = candidates?.find((r) => r.status?.id === 1 || r.status?.id === 2) || null
  if (!hero) return null

  const heroGenres = hero.genres ? hero.genres.split(',').map(g => g.trim()).filter(Boolean).slice(0, 3) : []
  const heroStatus = hero.status?.name
  const poster = img(hero.image)

  if (design === 'modern') {
    return (
      <div className="mdp-browse-hero mdk-glass">
        <div className="mdp-browse-hero-in">
          <span className="mdp-browse-kick">◆ В центре внимания</span>
          <h1>{hero.title_ru}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasGrade(hero) && <span className="mdk-chip mdk-chip-solid">★ {hero.grade!.toFixed(1)}</span>}
            {heroStatus && <span className="mdk-chip">{heroStatus}</span>}
            {heroGenres.map(g => <span key={g} className="mdk-chip">{g}</span>)}
          </div>
          {hero.description && <p className="mdp-browse-desc">{hero.description}</p>}
          <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
            <button className="mdk-btn mdk-btn-primary" onClick={() => navigate(`/watch/${hero.id}`)}>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Смотреть
            </button>
            <button className="mdk-btn mdk-btn-ghost" onClick={() => navigate(`/release/${hero.id}`)}>
              <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg> Подробнее
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-surface overflow-hidden mb-7">
      {poster && (
        <>
          <img src={poster} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none"
               style={{ filter: 'blur(50px) saturate(1.3)', opacity: 0.35 }} />
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'linear-gradient(120deg, rgba(7,6,11,0.55), rgba(7,6,11,0.92) 70%)' }} />
        </>
      )}
      <div className="relative flex gap-6 p-6 sm:p-8 flex-col sm:flex-row sm:items-center">
        {poster && (
          <img src={poster} alt={hero.title_ru}
               className="w-28 sm:w-36 aspect-[2/3] object-cover rounded-xl border border-white/10 shadow-lg shrink-0 mx-auto sm:mx-0" />
        )}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-soft mb-2">
            ◆ В центре внимания
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{hero.title_ru}</h1>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {hasGrade(hero) && <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-xs font-semibold text-accent-soft">★ {hero.grade!.toFixed(1)}</span>}
            {heroStatus && <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-xs text-muted">{heroStatus}</span>}
            {heroGenres.map(g => <span key={g} className="px-2.5 py-1 rounded-full bg-white/[0.06] text-xs text-muted">{g}</span>)}
          </div>
          {hero.description && (
            <p className="text-sm text-muted mt-3 max-w-xl line-clamp-3">{hero.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={() => navigate(`/watch/${hero.id}`)} className="btn-primary">▶ Смотреть</button>
            <button onClick={() => navigate(`/release/${hero.id}`)} className="btn-ghost">Подробнее</button>
          </div>
        </div>
      </div>
    </div>
  )
}
