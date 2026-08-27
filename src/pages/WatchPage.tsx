import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  getDubbers,
  getSources,
  getEpisodes,
  getEpisodeTarget,
  getWatchProgress,
  getReleaseProgress,
  getWatchSelection,
  saveWatchProgress,
  saveWatchSelection,
} from '../api/episodes'
import type { WatchProgressEntry } from '../api/episodes'
import { getRelease } from '../api/releases'
import { isPlayableUrl } from '../lib/playableHost'
import { getAnimelibTeams, setAnimelibOverride } from '../api/animelib'
import { getContinueWatching, watchedPct, fmtTime } from '../api/progress'
import { getEpisodeRatings } from '../api/ratings'
import type { EpisodeType, EpisodeSource, Episode } from '../api/episodes'
import type { Release } from '../api/releases'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import '../styles/modern-watch.css'

interface WatchLocationState {
  preferredTypeId?: number
  preferredSourceId?: number
}

// A second, synthetic "Источник" entry alongside whatever Anixart's own
// id:-1 — служебный признак, с настоящими источниками Anixart он не столкнётся:
// те всегда положительные.
const ANIMELIB_SOURCE: EpisodeSource = { id: -1, name: 'AnimeLib' }

const ANIMELIB_REASONS: Record<string, string> = {
  no_token: 'AnimeLib не подключён — зайди в Настройки',
  title_not_found: 'Тайтл не найден на AnimeLib',
  episode_not_found: 'Серия не найдена на AnimeLib',
  no_native_source: 'У этого тайтла нет своего плеера AnimeLib',
}

// «12 серия», «Серия 12» и «12» ничего не добавляют к самому номеру.
function isGenericEpisodeName(name: string | undefined, position: number): boolean {
  if (!name) return true
  const n = name.trim().toLowerCase().replace(/ё/g, 'е')
  return (
    n === String(position) ||
    n === `${position} серия` ||
    n === `серия ${position}` ||
    n === `эпизод ${position}`
  )
}

export default function WatchPage() {
  const design = useDesign()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state as WatchLocationState | null) || null

  const [release, setRelease] = useState<Release | null>(null)
  const [types, setTypes] = useState<EpisodeType[]>([])
  const [sources, setSources] = useState<EpisodeSource[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])

  const [selectedType, setSelectedType] = useState<EpisodeType | null>(null)
  const [selectedSource, setSelectedSource] = useState<EpisodeSource | null>(null)

  // AnimeLib as a source: its own dub-team list (озвучка), fetched lazily —
  // полностью отдельно от `types` Anixart — для Kodik они не меняются.
  const [animelibTeams, setAnimelibTeams] = useState<EpisodeType[]>([])
  const [selectedAnimelibTeam, setSelectedAnimelibTeam] = useState<EpisodeType | null>(null)
  const [animelibEpisodeNumbers, setAnimelibEpisodeNumbers] = useState<string[]>([])
  const [animelibLoading, setAnimelibLoading] = useState(false)
  const [animelibMsg, setAnimelibMsg] = useState('')
  const [animelibReason, setAnimelibReason] = useState('')
  const [animelibOverrideInput, setAnimelibOverrideInput] = useState('')
  const [animelibOverrideBusy, setAnimelibOverrideBusy] = useState(false)
  // Увеличиваем после сохранения ручного пина, чтобы поиск ниже перезапустился:
  // сам по себе он на это не среагирует.
  const [animelibRetry, setAnimelibRetry] = useState(0)
  const isAnimelibSource = selectedSource?.id === ANIMELIB_SOURCE.id
  // Вставка ссылки помогает только когда не совпал тайтл, а не когда аккаунт не
  // подключён или своего плеера у тайтла нет.
  const canOverrideAnimelib = animelibReason === 'title_not_found' || animelibReason === 'episode_not_found'

  const [loading, setLoading] = useState(true)
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [error, setError] = useState('')
  const [hideFillers, setHideFillers] = useState(false)
  // Позиция внутри серии в секундах по номеру серии — из неё рисуется полоска
  // досмотренного на плитке.
  const [epProgress, setEpProgress] = useState<Map<number, { position: number; duration: number }>>(new Map())
  const [epRatings, setEpRatings] = useState<Record<string, number>>({})

  const savedSelection = id ? getWatchSelection(id) : null
  // Последняя просмотренная серия релиза. Сначала мгновенно из локального кэша,
  // затем подменяем значением из истории аккаунта, чтобы
  // "Продолжить" button + preselected source match other devices.
  const [savedProgress, setSavedProgress] = useState<WatchProgressEntry | null>(() => (id ? getWatchProgress(id) : null))
  useEffect(() => {
    if (!id) { setSavedProgress(null); return }
    setSavedProgress(getWatchProgress(id))
    let cancelled = false
    getReleaseProgress(id).then((p) => { if (!cancelled && p) setSavedProgress(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id) return
    getRelease(id)
      .then((data) => {
        const nextRelease = data.release || null
        setRelease(nextRelease)
      })
      .catch(() => setRelease(null))
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getDubbers(id)
      .then(data => {
        const list = data.types || []
        setTypes(list)

        const preferredTypeId = routeState?.preferredTypeId || savedSelection?.typeId || savedProgress?.typeId
        let preferredType = list.find((item) => item.id === preferredTypeId)
        // В истории аккаунта есть только имя озвучки, без id — сверяем по имени.
        if (!preferredType && savedProgress?.typeName) preferredType = list.find((t) => t.name === savedProgress.typeName)
        preferredType = preferredType || list[0] || null
        setSelectedType(preferredType)
      })
      .catch(() => setError('Ошибка загрузки озвучек'))
      .finally(() => setLoading(false))
  }, [id, routeState?.preferredTypeId, savedProgress?.typeId, savedProgress?.typeName, savedSelection?.typeId])

  useEffect(() => {
    if (!id || !selectedType) return
    getSources(id, selectedType.id)
      .then(data => {
        const list = data.sources || []
        setSources(list)

        const preferredSourceId = routeState?.preferredSourceId || savedSelection?.sourceId || savedProgress?.sourceId
        const preferredSource = list.find((item) => item.id === preferredSourceId) || list[0] || null
        setSelectedSource(preferredSource)
        saveWatchSelection(id, { typeId: selectedType.id, sourceId: preferredSource?.id })
      })
      .catch(() => {
        setSources([])
        setSelectedSource(null)
      })
  }, [id, selectedType, routeState?.preferredSourceId, savedProgress?.sourceId, savedSelection?.sourceId])

  useEffect(() => {
    // AnimeLib не настоящий источник Anixart: спрашивать у него серии под id -1
    // бессмысленно.
    if (!id || !selectedType || !selectedSource || isAnimelibSource) return
    setLoadingEpisodes(true)
    setEpisodes([])
    getEpisodes(id, selectedType.id, selectedSource.id)
      .then(data => {
        const list = data.episodes || []
        if (list.length > 0) {
          setEpisodes(list)
        } else {
          const count = selectedSource.episodes_count || 0
          const generated: Episode[] = Array.from({ length: count }, (_, i) => ({ position: i + 1 }))
          setEpisodes(generated)
        }
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEpisodes(false))
  }, [id, selectedType, selectedSource, isAnimelibSource])

  // Команды AnimeLib и настоящий список серий, тянем лениво при первом выборе
  // этого источника. Ключом служит ref, а не состояние загрузки: состояние
  // асинхронного вызова в зависимостях зацикливает эффект сам на себя.
  const animelibFetchKey = `${id || ''}:${animelibRetry}`
  const animelibFetchedKeyRef = useRef('')
  useEffect(() => {
    if (!id || !isAnimelibSource || !release) return
    if (animelibFetchedKeyRef.current === animelibFetchKey) return
    animelibFetchedKeyRef.current = animelibFetchKey
    setAnimelibLoading(true)
    setAnimelibMsg('')
    setAnimelibReason('')
    setAnimelibTeams([])
    setAnimelibEpisodeNumbers([])
    getAnimelibTeams(id, { orig: release.title_original, ru: release.title_ru, en: release.title_en })
      .then((res) => {
        if (res.found && res.teams?.length) {
          const list: EpisodeType[] = res.teams.map((name, i) => ({ id: i, name }))
          setAnimelibTeams(list)
          setSelectedAnimelibTeam(list[0])
          setAnimelibEpisodeNumbers(res.episodeNumbers || [])
        } else {
          setAnimelibMsg(ANIMELIB_REASONS[res.reason || ''] || 'Не найдено на AnimeLib')
          setAnimelibReason(res.reason || '')
        }
      })
      .finally(() => setAnimelibLoading(false))
  }, [id, isAnimelibSource, release, animelibFetchKey])

  // API AnimeLib иногда моргает дольше, чем терпят ретраи на бэкенде. Кнопка
  // «повторить» лучше, чем предлагать перевыбрать источник или обновить страницу.
  const retryAnimelib = () => setAnimelibRetry((v) => v + 1)

  const submitAnimelibOverride = async () => {
    if (!id || !animelibOverrideInput.trim()) return
    setAnimelibOverrideBusy(true)
    try {
      const ok = await setAnimelibOverride(id, animelibOverrideInput.trim())
      if (!ok) { setAnimelibMsg('Не удалось сохранить — проверь ссылку/id'); return }
      setAnimelibOverrideInput('')
      setAnimelibMsg('')
      setAnimelibRetry((v) => v + 1)
    } finally {
      setAnimelibOverrideBusy(false)
    }
  }

  // Настоящие номера серий AnimeLib: у split-cour тайтлов количество из Anixart
  // с ними не совпадает. На количество из Anixart опираемся, только пока список
  // не загрузился, чтобы сетка не была пустой.
  const animelibEpisodeCount = release?.episodes_released || release?.episodes_total || 0
  const animelibEpisodes = useMemo<Episode[]>(() => {
    if (animelibEpisodeNumbers.length > 0) {
      return animelibEpisodeNumbers.map((n) => ({ position: Number(n) || 0 })).filter((e) => e.position > 0)
    }
    return Array.from({ length: animelibEpisodeCount }, (_, i) => ({ position: i + 1 }))
  }, [animelibEpisodeNumbers, animelibEpisodeCount])
  const activeEpisodes = isAnimelibSource ? animelibEpisodes : episodes

  useEffect(() => {
    if (!id || !selectedSource) { setEpProgress(new Map()); return }
    let cancelled = false
    getContinueWatching().then((items) => {
      if (cancelled) return
      const sid = String(selectedSource.id)
      const map = new Map<number, { position: number; duration: number }>()
      for (const it of items) {
        if (it.releaseId === String(id) && it.sourceId === sid) {
          map.set(Number(it.episode), { position: it.position, duration: it.duration })
        }
      }
      setEpProgress(map)
    })
    return () => { cancelled = true }
  }, [id, selectedSource])

  useEffect(() => {
    if (!id || !selectedSource) { setEpRatings({}); return }
    getEpisodeRatings(id, selectedSource.id).then(setEpRatings).catch(() => {})
  }, [id, selectedSource])

  const handleEpisodeClick = async (episode: Episode) => {
    if (!id || !selectedSource) return

    if (isAnimelibSource) {
      if (!selectedAnimelibTeam) { alert('Выбери озвучку AnimeLib'); return }
      saveWatchProgress({
        releaseId: id,
        releaseTitle: release?.title_ru,
        releaseImage: release?.image,
        typeName: selectedAnimelibTeam.name,
        sourceId: ANIMELIB_SOURCE.id,
        sourceName: ANIMELIB_SOURCE.name,
        episodePosition: episode.position,
        episodeName: episode.name || `Эпизод ${episode.position}`,
        updatedAt: Date.now(),
      })
      navigate('/player', {
        state: {
          animelibTeam: selectedAnimelibTeam.name,
          releaseId: id,
          sourceId: ANIMELIB_SOURCE.id,
          position: episode.position,
          episodeName: episode.name || `Эпизод ${episode.position}`,
          releaseName: release?.title_ru,
          dubberName: selectedAnimelibTeam.name,
          sourceName: ANIMELIB_SOURCE.name,
          totalEpisodes: animelibEpisodeCount,
          titleOriginal: release?.title_original,
          // Под id -1 отметить серию просмотренной нельзя — Anixart такого
          // источника не знает и отвечает 404. Для самого вызова годится любой
          // настоящий источник релиза, ему важен факт просмотра, а не кто его
          // сообщил. Прогресс при этом продолжает жить под -1.
          markWatchedSourceId: sources[0]?.id,
        },
      })
      return
    }

    try {
      const data = await getEpisodeTarget(id, selectedSource.id, episode.position)
      const ep = data.episode
      const rawUrl = ep?.url || ''
      if (!rawUrl) {
        alert('Не удалось получить ссылку на эпизод')
        return
      }
      const kodikUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
      if (!isPlayableUrl(kodikUrl)) {
        alert(`Источник «${selectedSource.name}» сейчас не поддерживается плеером — выберите другой в списке озвучек.`)
        return
      }

      saveWatchProgress({
        releaseId: id,
        releaseTitle: release?.title_ru,
        releaseImage: release?.image,
        typeId: selectedType?.id,
        typeName: selectedType?.name,
        sourceId: selectedSource.id,
        sourceName: selectedSource.name,
        episodePosition: episode.position,
        episodeName: episode.name || `Эпизод ${episode.position}`,
        updatedAt: Date.now(),
      })
      saveWatchSelection(id, { typeId: selectedType?.id, sourceId: selectedSource.id })

      const totalEpisodes = episodes.length
        ? Math.max(...episodes.map((e) => e.position))
        : (selectedSource.episodes_count || 0)

      navigate('/player', {
        state: {
          kodikUrl,
          releaseId: id,
          sourceId: selectedSource.id,
          position: episode.position,
          episodeName: episode.name || `Эпизод ${episode.position}`,
          releaseName: release?.title_ru,
          dubberName: selectedType?.name,
          sourceName: selectedSource.name,
          totalEpisodes,
          typeId: selectedType?.id, // панель серий берёт отсюда настоящие названия
          titleOriginal: release?.title_original,
        },
      })
    } catch (e) {
      const err = e as Error
      alert(`Ошибка: ${err.message}`)
    }
  }

  const continueEpisode = useMemo(() => {
    if (!savedProgress) return null
    const found = episodes.find((episode) => episode.position === savedProgress.episodePosition)
    return found || { position: savedProgress.episodePosition, name: savedProgress.episodeName }
  }, [episodes, savedProgress])

  const nextEpisode = useMemo(() => {
    if (!savedProgress) return null
    return episodes.find((episode) => episode.position === savedProgress.episodePosition + 1) || null
  }, [episodes, savedProgress])

  const fillerCount = useMemo(() => activeEpisodes.filter((e) => e.is_filler).length, [activeEpisodes])
  const visibleEpisodes = useMemo(
    () => (hideFillers ? activeEpisodes.filter((e) => !e.is_filler) : activeEpisodes),
    [activeEpisodes, hideFillers],
  )

  if (loading) return <Spinner variant="watch" />
  if (error) return <div className="text-center text-red-400 py-20 text-sm">{error}</div>

  if (design === 'modern') {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-muted hover:text-text transition-colors mb-3 inline-block">
          ← {release?.title_ru || 'Назад'}
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-2">
          <div>
            <h1 className="text-[28px] font-bold">Выбор серии</h1>
            <p className="text-sm text-muted mt-1">озвучка · источник · серия — запоминаются</p>
          </div>
          {continueEpisode && (
            <button onClick={() => handleEpisodeClick(continueEpisode)} className="mdk-btn mdk-btn-primary">
              ▸ Продолжить · серия {continueEpisode.position}
            </button>
          )}
          {nextEpisode && (
            <button onClick={() => handleEpisodeClick(nextEpisode)} className="mdk-btn mdk-btn-ghost">
              Следующая · серия {nextEpisode.position}
            </button>
          )}
        </div>

        {savedProgress && (
          <div className="mdk-glass mdk-pad text-sm text-muted mb-2">
            Последний просмотр: серия {savedProgress.episodePosition}
            {savedProgress.sourceName ? ` · ${savedProgress.sourceName}` : ''}
            {savedProgress.typeName ? ` · ${savedProgress.typeName}` : ''}
          </div>
        )}

        <div className="mdk-rowhead"><h2>Источник</h2></div>
        <div className="flex flex-wrap gap-2">
          {[...sources, ANIMELIB_SOURCE].map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSource(s)}
              className={`mdk-chip ${selectedSource?.id === s.id ? 'mdk-chip-acc' : ''}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {isAnimelibSource ? (
          <>
            <div className="mdk-rowhead"><h2>Озвучка</h2></div>
            {animelibLoading ? (
              <p className="text-sm text-muted">Ищу на AnimeLib…</p>
            ) : animelibTeams.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {animelibTeams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedAnimelibTeam(t)}
                    className={`mdk-chip ${selectedAnimelibTeam?.id === t.id ? 'mdk-chip-acc' : ''}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : animelibMsg ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted">{animelibMsg}</p>
                  <button onClick={retryAnimelib} className="mdk-chip shrink-0">Повторить</button>
                </div>
                {canOverrideAnimelib && (
                  <>
                    <p className="text-xs text-muted">Не нашли автоматически — открой тайтл на animelib.org и вставь ссылку сюда, дальше сработает для всех:</p>
                    <div className="flex gap-2">
                      <input
                        value={animelibOverrideInput}
                        onChange={(e) => setAnimelibOverrideInput(e.target.value)}
                        placeholder="Ссылка или id тайтла на animelib.org"
                        className="input flex-1"
                      />
                      <button
                        onClick={submitAnimelibOverride}
                        disabled={animelibOverrideBusy || !animelibOverrideInput.trim()}
                        className="btn-primary !py-2 text-sm shrink-0"
                      >
                        {animelibOverrideBusy ? '…' : 'Указать'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : types.length > 0 && (
          <>
            <div className="mdk-rowhead"><h2>Озвучка</h2></div>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t)}
                  className={`mdk-chip ${selectedType?.id === t.id ? 'mdk-chip-acc' : ''}`}
                >
                  {t.name}{t.episodes_count ? ` · ${t.episodes_count}` : ''}
                </button>
              ))}
            </div>
          </>
        )}

        {loadingEpisodes ? (
          <Spinner variant="watch" />
        ) : activeEpisodes.length > 0 ? (
          <>
            <div className="mdk-rowhead">
              <h2>Эпизоды · <b>{hideFillers ? visibleEpisodes.length : activeEpisodes.length}</b></h2>
              {fillerCount > 0 && (
                <button onClick={() => setHideFillers(v => !v)} className={`mdk-chip ${hideFillers ? 'mdk-chip-acc' : ''}`}>
                  {hideFillers ? 'Филлеры скрыты' : 'Скрыть филлеры'}
                </button>
              )}
            </div>
            <div className="mdp-watch-grid">
              {visibleEpisodes.map(ep => {
                const isResume = savedProgress?.episodePosition === ep.position
                const epName = isGenericEpisodeName(ep.name, ep.position) ? '' : ep.name
                const epRating = epRatings[String(ep.position)]
                const prog = epProgress.get(ep.position)
                const pct = prog ? watchedPct(prog.position, prog.duration) : 0
                return (
                  <button
                    key={ep.position}
                    onClick={() => handleEpisodeClick(ep)}
                    title={ep.name}
                    className={`mdp-watch-ep ${isResume ? 'mdp-on' : ''} ${ep.is_watched ? 'mdp-watched' : ''} ${ep.is_filler ? 'mdp-filler' : ''}`}
                  >
                    <b>{ep.position}</b>
                    {epName && <span className="mdp-watch-name">{epName}</span>}
                    {epRating && <span className="mdk-rbadge" style={{ top: 5, right: 5 }}>★{epRating}</span>}
                    {ep.is_filler && <span className="mdp-watch-filler-mark">Ф</span>}
                    {ep.is_watched && !prog && <span className="mdp-watch-done" />}
                    {prog && pct > 0 ? (
                      <span className="mdp-watch-resume-lbl">▸ {fmtTime(prog.position)}</span>
                    ) : isResume ? (
                      <span className="mdp-watch-resume-lbl">Продолжить</span>
                    ) : null}
                    {prog && pct > 0 && (
                      <span className="mdp-watch-pbar"><b style={{ width: `${pct}%` }} /></span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="text-center text-muted py-20 text-sm">Эпизоды не найдены</div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text transition-colors mb-6 inline-flex items-center gap-1"
      >
        ← Назад
      </button>

      <div className="panel p-5 sm:p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{release?.title_ru || 'Выбор серии'}</h1>
            <p className="text-sm text-muted mt-2">
              Выбери озвучку, источник и серию. Выбранные параметры сохраняются локально.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {continueEpisode && (
              <button
                onClick={() => handleEpisodeClick(continueEpisode)}
                className="btn-primary flex flex-col items-center !py-1.5 leading-tight"
              >
                <span>Продолжить</span>
                <span className="text-[11px] font-normal opacity-75">серия {continueEpisode.position}</span>
              </button>
            )}
            {nextEpisode && (
              <button
                onClick={() => handleEpisodeClick(nextEpisode)}
                className="btn-ghost flex flex-col items-center !py-1.5 leading-tight"
              >
                <span>Следующая</span>
                <span className="text-[11px] font-normal text-muted">серия {nextEpisode.position}</span>
              </button>
            )}
          </div>
        </div>

        {savedProgress && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-muted">
            Последний просмотр: серия {savedProgress.episodePosition}
            {savedProgress.sourceName ? ` · ${savedProgress.sourceName}` : ''}
            {savedProgress.typeName ? ` · ${savedProgress.typeName}` : ''}
          </div>
        )}
      </div>

      <section className="mb-5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-2.5">Источник</h3>
        <div className="flex flex-wrap gap-1.5">
          {[...sources, ANIMELIB_SOURCE].map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSource(s)}
              className={`chip ${selectedSource?.id === s.id ? 'chip-active' : ''}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {isAnimelibSource ? (
        <section className="mb-7">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-2.5">Озвучка</h3>
          {animelibLoading ? (
            <p className="text-sm text-muted">Ищу на AnimeLib…</p>
          ) : animelibTeams.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {animelibTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedAnimelibTeam(t)}
                  className={`chip ${selectedAnimelibTeam?.id === t.id ? 'chip-active' : ''}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          ) : animelibMsg ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted">{animelibMsg}</p>
                <button onClick={retryAnimelib} className="chip shrink-0">Повторить</button>
              </div>
              {canOverrideAnimelib && (
                <>
                  <p className="text-xs text-muted">Не нашли автоматически — открой тайтл на animelib.org и вставь ссылку сюда, дальше сработает для всех:</p>
                  <div className="flex gap-2">
                    <input
                      value={animelibOverrideInput}
                      onChange={(e) => setAnimelibOverrideInput(e.target.value)}
                      placeholder="Ссылка или id тайтла на animelib.org"
                      className="input flex-1"
                    />
                    <button
                      onClick={submitAnimelibOverride}
                      disabled={animelibOverrideBusy || !animelibOverrideInput.trim()}
                      className="btn-primary !py-2 text-sm shrink-0"
                    >
                      {animelibOverrideBusy ? '…' : 'Указать'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : types.length > 0 && (
        <section className="mb-7">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-2.5">Озвучка</h3>
          <div className="flex flex-wrap gap-1.5">
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t)}
                className={`chip ${selectedType?.id === t.id ? 'chip-active' : ''}`}
              >
                {t.name}
                {t.episodes_count ? <span className="ml-1 opacity-60">· {t.episodes_count}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {loadingEpisodes ? (
        <Spinner variant="watch" />
      ) : activeEpisodes.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Эпизоды · {hideFillers ? visibleEpisodes.length : activeEpisodes.length}
              {fillerCount > 0 && <span className="ml-1 text-amber-400/70">· филлеров {fillerCount}</span>}
            </h3>
            {fillerCount > 0 && (
              <button
                onClick={() => setHideFillers(v => !v)}
                className={`chip ${hideFillers ? 'chip-active' : ''}`}
              >
                {hideFillers ? 'Филлеры скрыты' : 'Скрыть филлеры'}
              </button>
            )}
          </div>
          <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {visibleEpisodes.map(ep => {
              const isResume = savedProgress?.episodePosition === ep.position
              const epName = isGenericEpisodeName(ep.name, ep.position) ? '' : ep.name
              const epRating = epRatings[String(ep.position)]
              const prog = epProgress.get(ep.position)
              const pct = prog ? watchedPct(prog.position, prog.duration) : 0
              return (
                <button
                  key={ep.position}
                  onClick={() => handleEpisodeClick(ep)}
                  title={ep.name}
                  className={`group relative overflow-hidden rounded-xl py-3 px-2 text-sm border transition-all duration-150
                    ${ep.is_watched
                      ? 'bg-white/[0.02] border-white/[0.05] text-muted'
                      : 'bg-white/[0.03] border-white/[0.07] text-text/90 hover:border-accent/40 hover:bg-accent/[0.06]'}
                    ${isResume ? '!border-accent/50 !bg-accent/[0.08]' : ''}
                    ${ep.is_filler ? '!border-amber-500/30' : ''}`}
                >
                  <span className="font-semibold">{ep.position}</span>
                  {epName && (
                    <span className="block mt-0.5 text-[10px] leading-tight text-muted line-clamp-2">{epName}</span>
                  )}
                  {epRating && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold text-yellow-400 leading-none">
                      ★{epRating}
                    </span>
                  )}
                  {ep.is_filler && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold text-amber-400/90">Ф</span>
                  )}
                  {ep.is_watched && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent/60" />
                  )}
                  {prog && pct > 0 ? (
                    <span className="absolute inset-x-1 bottom-1 text-[10px] font-medium text-accent truncate">
                      ▸ {fmtTime(prog.position)}
                    </span>
                  ) : isResume ? (
                    <span className="absolute inset-x-1 bottom-1 text-[10px] text-accent-soft truncate">
                      Продолжить
                    </span>
                  ) : null}
                  {prog && pct > 0 && (
                    <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/30">
                      <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="text-center text-muted py-20 text-sm">Эпизоды не найдены</div>
      )}
    </div>
  )
}
