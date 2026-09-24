import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getRelease, extractReleases, type Release } from '../api/releases'
import {
  getDubbers, getSources, getEpisodes, getEpisodeTarget, getReleaseProgress,
  getWatchSelection, saveWatchSelection, saveWatchProgress,
  type Episode, type EpisodeSource, type EpisodeType, type WatchProgressEntry,
} from '../api/episodes'
import { toggleFavorite } from '../api/bookmarks'
import { isPlayableUrl } from '../lib/playableHost'
import { resumeWatch } from '../lib/resume'
import { Billboard, Icon, Spinner, TvCard } from './parts'
import { TvRow, TvScroller, useInitialFocus } from './focus'

/** Длинные сериалы режем на диапазоны: тысяча плиток разом ТВ не по силам. */
const RANGE = 50

// Экран пересоздаётся на каждый тайтл (переход «Связанное» → другой тайтл), чтобы
// не тащить озвучки и серии прошлого.
export default function TvReleaseRoute() {
  const { id = '' } = useParams()
  return <TvRelease key={id} />
}

function TvRelease() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const autoplay = !!(location.state as { autoplay?: boolean } | null)?.autoplay

  const [release, setRelease] = useState<Release | null>(null)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState<WatchProgressEntry | null | undefined>(undefined)
  const [types, setTypes] = useState<EpisodeType[] | null>(null)
  const [type, setType] = useState<EpisodeType | null>(null)
  const [sources, setSources] = useState<EpisodeSource[]>([])
  const [source, setSource] = useState<EpisodeSource | null>(null)
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [range, setRange] = useState(0)
  const [favorite, setFavorite] = useState(false)
  const [toast, setToast] = useState('')
  const autoplayDone = useRef(false)

  useEffect(() => {
    setRelease(null); setFailed(false); setProgress(undefined)
    getRelease(id)
      .then((d) => {
        const r = d.release || extractReleases(d)[0] || null
        setRelease(r); setFavorite(!!(r && r.is_favorite))
        if (!r) setFailed(true)
      })
      .catch(() => setFailed(true))
    getReleaseProgress(id).then(setProgress).catch(() => setProgress(null))
  }, [id])

  // Озвучка и плеер: как на вебе — сохранённый выбор, потом последний просмотр, потом первый.
  useEffect(() => {
    if (progress === undefined) return
    const saved = getWatchSelection(id)
    getDubbers(id).then((d) => {
      const list = d.types || []
      setTypes(list)
      const want = (saved && saved.typeId) || (progress && progress.typeId)
      setType(
        list.find((t) => t.id === want) ||
        (progress && progress.typeName ? list.find((t) => t.name === progress.typeName) : undefined) ||
        list[0] || null,
      )
    }).catch(() => setTypes([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, progress])

  useEffect(() => {
    if (!type) return
    const saved = getWatchSelection(id)
    getSources(id, type.id).then((d) => {
      const list = d.sources || []
      setSources(list)
      const want = (saved && saved.sourceId) || (progress && progress.sourceId)
      setSource(list.find((s) => s.id === want) || list[0] || null)
    }).catch(() => { setSources([]); setSource(null) })
  }, [id, type])

  useEffect(() => {
    if (!type || !source) return
    setEpisodes(null)
    getEpisodes(id, type.id, source.id).then((d) => {
      const list = d.episodes && d.episodes.length
        ? d.episodes
        : Array.from({ length: source.episodes_count || 0 }, (_, i) => ({ position: i + 1 }))
      setEpisodes(list)
      const cur = progress && progress.sourceId === source.id ? progress.episodePosition : 0
      const idx = cur ? list.findIndex((e) => e.position === cur) : -1
      setRange(idx > 0 ? Math.floor(idx / RANGE) : 0)
    }).catch(() => setEpisodes([]))
  }, [id, type, source])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function playEpisode(ep: Episode) {
    if (!type || !source || !release) return
    try {
      const data = await getEpisodeTarget(id, source.id, ep.position)
      const raw = (data.episode && data.episode.url) || ''
      const url = raw.startsWith('//') ? `https:${raw}` : raw
      if (!url || !isPlayableUrl(url)) { flash('Этот плеер не поддерживается — выбери другой'); return }
      const episodeName = ep.name || `Эпизод ${ep.position}`
      saveWatchSelection(id, { typeId: type.id, sourceId: source.id })
      saveWatchProgress({
        releaseId: id, releaseTitle: release.title_ru, releaseImage: release.image,
        typeId: type.id, typeName: type.name, sourceId: source.id, sourceName: source.name,
        episodePosition: ep.position, episodeName, updatedAt: Date.now(),
        episodesTotal: release.episodes_total, episodesReleased: release.episodes_released,
      })
      navigate('/player', {
        state: {
          kodikUrl: url, releaseId: id, sourceId: source.id, position: ep.position, episodeName,
          releaseName: release.title_ru, dubberName: type.name, sourceName: source.name,
          totalEpisodes: episodes ? episodes.length : undefined, typeId: type.id,
          titleOriginal: release.title_original,
        },
      })
    } catch {
      flash('Не удалось открыть серию')
    }
  }

  function playMain() {
    if (progress) { resumeWatch(navigate, progress); return }
    if (episodes && episodes.length) playEpisode(episodes[0])
  }

  // «Смотреть» из баннера главной: запускаем сразу. Флаг из истории убираем, иначе
  // «Назад» из плеера снова запустит серию.
  useEffect(() => {
    if (!autoplay || autoplayDone.current || progress === undefined) return
    if (!progress && !episodes) return
    autoplayDone.current = true
    navigate(location.pathname, { replace: true, state: {} })
    playMain()
  })

  async function onFavorite() {
    if (!release) return
    try {
      await toggleFavorite(release.id, favorite)
      setFavorite(!favorite)
    } catch { flash('Не получилось изменить избранное') }
  }

  function focusEpisodes() {
    const cur = progress && source && progress.sourceId === source.id ? progress.episodePosition : 0
    const el = (cur && document.querySelector(`[data-tv-key="ep:${cur}"]`)) || document.querySelector('[data-tv-key^="ep:"]')
    if (el) (el as HTMLElement).focus()
  }

  // Ждём, пока «Смотреть» станет активной (нужны прогресс или список серий), — фокус встанет на неё.
  useInitialFocus(!!release && progress !== undefined && types !== null && (!!progress || episodes !== null || types.length === 0))

  const ranges = useMemo(() => {
    const n = episodes ? episodes.length : 0
    return n > RANGE ? Array.from({ length: Math.ceil(n / RANGE) }, (_, i) => i) : []
  }, [episodes])

  if (failed) return <div className="tv-center">Не удалось загрузить тайтл</div>
  if (!release) return <Spinner />

  const curPos = progress && source && progress.sourceId === source.id ? progress.episodePosition : 0
  const shownEpisodes = episodes ? (ranges.length ? episodes.slice(range * RANGE, range * RANGE + RANGE) : episodes) : []
  const mainLabel = progress ? `Продолжить · серия ${progress.episodePosition}` : 'Смотреть'
  const related = (release.related_releases || []).filter((r) => r.id !== release.id)
  const similar = release.recommended_releases || []

  return (
    <>
      <TvScroller top={0} offset={70}>
        <section data-tv-row="hero" style={{ position: 'relative', height: 700 }}>
          <Billboard release={release} height={700}>
            <div className="tv-actions">
              <button className="tv-btn primary" data-tv-autofocus data-tv-key="play" onClick={playMain}
                disabled={!progress && !(episodes && episodes.length)}>
                {Icon.play}{mainLabel}
              </button>
              <button className="tv-btn" data-tv-key="eps" onClick={focusEpisodes}>{Icon.list}Серии</button>
              <button className="tv-btn" data-tv-key="fav" onClick={onFavorite}>
                {Icon.heart}{favorite ? 'В избранном' : 'В избранное'}
              </button>
            </div>
          </Billboard>
        </section>

        {types && types.length > 1 && (
          <TvRow id="dub" title="Озвучка">
            {types.map((t) => (
              <button key={t.id} data-tv-item data-tv-key={`dub:${t.id}`}
                className={`tvchip${type && type.id === t.id ? ' on' : ''}`} onClick={() => setType(t)}>
                {t.name}
              </button>
            ))}
          </TvRow>
        )}

        {sources.length > 1 && (
          <TvRow id="src" title="Плеер">
            {sources.map((s) => (
              <button key={s.id} data-tv-item data-tv-key={`src:${s.id}`}
                className={`tvchip${source && source.id === s.id ? ' on' : ''}`} onClick={() => setSource(s)}>
                {s.name}{s.episodes_count ? ` · ${s.episodes_count} эп.` : ''}
              </button>
            ))}
          </TvRow>
        )}

        {ranges.length > 0 && (
          <TvRow id="range" title="Серии">
            {ranges.map((i) => (
              <button key={i} data-tv-item data-tv-key={`range:${i}`}
                className={`tvchip${range === i ? ' on' : ''}`} onClick={() => setRange(i)}>
                {episodes![i * RANGE].position}–{episodes![Math.min(episodes!.length, (i + 1) * RANGE) - 1].position}
              </button>
            ))}
          </TvRow>
        )}

        <TvRow id="eps" title={ranges.length ? undefined : 'Серии'} empty={episodes ? 'Серий пока нет' : 'Загружаю серии…'}>
          {shownEpisodes.map((ep) => (
            <button key={ep.position} data-tv-item data-tv-key={`ep:${ep.position}`}
              className={`tve${ep.is_watched ? ' watched' : ''}${ep.position === curPos ? ' current' : ''}`}
              onClick={() => playEpisode(ep)}>
              <div className="tve-num">{ep.position}</div>
              <div className="tve-name">{ep.name && ep.name !== `${ep.position} серия` ? ep.name : `Серия ${ep.position}`}</div>
              {ep.is_watched && <span className="tve-seen">✓ просмотрено</span>}
              {!ep.is_watched && ep.position === curPos && <span className="tve-seen">▶ здесь</span>}
            </button>
          ))}
        </TvRow>

        {related.length > 0 && (
          <TvRow id="related" title="Связанное">
            {related.map((r) => (
              <TvCard key={r.id} tvKey={`rel:${r.id}`} release={r} onPick={() => navigate(`/release/${r.id}`)} />
            ))}
          </TvRow>
        )}

        {similar.length > 0 && (
          <TvRow id="similar" title="Похожее">
            {similar.map((r) => (
              <TvCard key={r.id} tvKey={`sim:${r.id}`} release={r} onPick={() => navigate(`/release/${r.id}`)} />
            ))}
          </TvRow>
        )}
      </TvScroller>
      {toast && <div className="tv-toast">{toast}</div>}
    </>
  )
}
