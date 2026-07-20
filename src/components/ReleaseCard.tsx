import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toggleFavorite } from '../api/bookmarks'
import { getWatchProgress } from '../api/episodes'
import { hasGrade, type Release } from '../api/releases'
import { img } from '../lib/img'
import { useDesign } from '../lib/design'
import { getMyRating, loadMyRatings, subscribeMyRatings } from '../lib/myRatings'
import { getShikiScore, requestShikiScore, subscribeShikiScores } from '../lib/shikiScores'
import Img from './Img'

interface Props {
  release: Release
}

export default function ReleaseCard({ release }: Props) {
  // Личная оценка по десятибалльной шкале. Приходит одним запросом на всю
  // сессию, поэтому карточка подписывается и перерисовывается, когда данные
  // доехали, а не дёргает сервер на каждую плитку.
  const [myRating, setMyRating] = useState(() => getMyRating(release.id))
  // Общая оценка берётся с Shikimori: она десятибалльная, в отличие от
  // пятибалльной у Anixart. Запрос идёт пакетом на всю видимую сетку.
  const orig = release.title_original || ''
  const [shiki, setShiki] = useState(() => getShikiScore(orig))
  useEffect(() => {
    let alive = true
    const sync = () => { if (alive) setShiki(getShikiScore(orig)) }
    const off = subscribeShikiScores(sync)
    requestShikiScore(orig)
    sync()
    return () => { alive = false; off() }
  }, [orig])
  useEffect(() => {
    let alive = true
    const sync = () => { if (alive) setMyRating(getMyRating(release.id)) }
    const off = subscribeMyRatings(sync)
    void loadMyRatings().then(sync)
    return () => { alive = false; off() }
  }, [release.id])

  const design = useDesign()
  const navigate = useNavigate()
  const poster = img(release.image || '')
  const progress = useMemo(() => getWatchProgress(release.id), [release.id])
  const [isFavorite, setIsFavorite] = useState(!!release.is_favorite)

  const openRelease = () => navigate(`/release/${release.id}`)
  const openWatch = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    navigate(`/watch/${release.id}`)
  }

  const handleFavorite = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const prev = isFavorite
    setIsFavorite(!prev) // optimistic
    try {
      await toggleFavorite(release.id, prev)
    } catch {
      setIsFavorite(prev) // revert on failure
    }
  }

  if (design === 'modern') {
    return (
      <a className="mdk-card" onClick={openRelease}>
        <div className="mdk-poster" style={release.image ? { backgroundImage: `url(${poster})` } : undefined}>
          {shiki > 0 ? (
            <span className="mdk-rbadge">★{shiki.toFixed(2)}</span>
          ) : hasGrade(release) && (
            <span className="mdk-rbadge">★{release.grade!.toFixed(1)}</span>
          )}
          {myRating > 0 && <span className="mdk-mybadge">{myRating}/10</span>}
          {progress && <span className="mdk-badge">Серия {progress.episodePosition}</span>}
          <div className="mdk-play">
            <span onClick={openWatch}><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
          </div>
          {progress?.episodesTotal ? (
            <div className="mdk-pbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <i><b style={{ width: `${Math.min(100, (progress.episodePosition / progress.episodesTotal) * 100)}%` }} /></i>
            </div>
          ) : null}
        </div>
        <p className="mdk-ct">{release.title_ru}</p>
        <p className="mdk-cs">
          {release.year || (progress ? (progress.sourceName || progress.typeName) : '')}
          <span
            onClick={handleFavorite}
            style={{ float: 'right', color: isFavorite ? 'rgb(var(--accent-rgb))' : undefined, cursor: 'pointer' }}
          >
            {isFavorite ? '★' : '☆'}
          </span>
        </p>
      </a>
    )
  }

  return (
    <button
      onClick={openRelease}
      className="group text-left focus:outline-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface
                      border border-white/[0.06] transition-all duration-300
                      group-hover:border-accent/50 group-hover:shadow-accent-glow
                      group-hover:-translate-y-1 group-focus-visible:border-accent/40">
        {poster ? (
          <Img
            src={poster}
            proxy={false}
            alt={release.title_ru}
            className="w-full h-full"
            imgClassName="transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/60 text-xs px-2 text-center">
            Нет постера
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity" />

        {hasGrade(release) && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[11px] font-semibold
                          bg-black/60 backdrop-blur text-accent-soft">
            {shiki > 0 ? shiki.toFixed(2) : release.grade!.toFixed(1)}
          </div>
        )}

        {/* Своя оценка — под общей, чтобы не спорили за один угол. */}
        {myRating > 0 && (
          <div className="absolute right-2 px-1.5 py-0.5 rounded-md text-[11px] font-bold
                          bg-accent text-black" style={{ top: hasGrade(release) ? 30 : 8 }}>
            {myRating}/10
          </div>
        )}

        {progress && (
          <div className="absolute left-2 top-2 px-2 py-1 rounded-md text-[11px] font-semibold bg-black/65 text-white">
            Серия {progress.episodePosition}
          </div>
        )}

        <div className="absolute inset-x-2 bottom-2 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
          <button
            onClick={openWatch}
            className="flex-1 rounded-lg bg-black/70 text-white text-xs px-3 py-2 backdrop-blur hover:bg-black/80"
          >
            Смотреть
          </button>
          <button
            onClick={handleFavorite}
            className={`rounded-lg px-3 py-2 text-xs backdrop-blur ${isFavorite ? 'bg-yellow-500/80 text-black' : 'bg-black/70 text-white hover:bg-black/80'}`}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-text/90 line-clamp-2 leading-snug group-hover:text-text transition-colors">
        {release.title_ru}
      </p>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        {release.year ? (
          <p className="text-xs text-muted">{release.year}</p>
        ) : <span />}
        {progress && (
          <p className="text-[11px] text-accent-soft truncate">
            {progress.sourceName || progress.typeName || 'Продолжить'}
          </p>
        )}
      </div>
    </button>
  )
}
