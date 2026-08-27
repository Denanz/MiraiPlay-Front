import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getEpisodeTarget, saveWatchProgress } from '../api/episodes'
import { isPlayableUrl } from '../lib/playableHost'
import { getRelease, buildRecommendations, type Release } from '../api/releases'
import { img } from '../lib/img'
import { WatchRoom, type WtContent } from '../api/together'
import QueuePanel from '../components/QueuePanel'
import EpisodesPanel from '../components/EpisodesPanel'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { useDesign } from '../lib/design'

// Нативный плагин: прячет системные панели, пока открыт плеер.
const Immersive = registerPlugin<{ enable: () => Promise<void>; disable: () => Promise<void> }>('Immersive')

interface PlayerState {
  /** Отсутствует, когда источник — AnimeLib (см. animelibTeam): резолв ссылки
   *  тогда происходит на сервере при открытии /player, а не заранее здесь. */
  kodikUrl?: string
  releaseId: string
  sourceId: number
  position: number
  episodeName: string
  releaseName?: string
  dubberName?: string
  sourceName?: string
  totalEpisodes?: number
  /** Нужен панели серий для настоящих названий; у гостя комнаты может отсутствовать. */
  typeId?: number
  /** Оригинальное (ромадзи) название — для матчинга тайтла на AnimeLib. */
  titleOriginal?: string
  /** Выбранная команда AnimeLib — источник вместо kodikUrl. */
  animelibTeam?: string
  /** Реальный Anixart-источник для отметки "просмотрено" на аккаунте — у
   *  AnimeLib-плейбека sourceId:-1 не существует в системе Anixart. */
  markWatchedSourceId?: number
}

const API_BASE = 'https://aniapi.denanz.fun'

function contentOf(s: PlayerState): WtContent {
  return {
    releaseId: s.releaseId, sourceId: s.sourceId, position: s.position,
    episodeName: s.episodeName, releaseName: s.releaseName,
    dubberName: s.dubberName, sourceName: s.sourceName, totalEpisodes: s.totalEpisodes,
    kodikUrl: s.kodikUrl, // so guests can play without a token
    titleOriginal: s.titleOriginal,
    animelibTeam: s.animelibTeam,
  }
}

async function resolveContent(c: WtContent): Promise<PlayerState> {
  // У AnimeLib нечего резолвить заранее: это делает /player на сервере, ему нужен
  // личный токен зрителя. Передать готовую ссылку гостю, как в случае Kodik, нельзя.
  if (c.animelibTeam) {
    return {
      releaseId: c.releaseId, sourceId: c.sourceId, position: c.position,
      episodeName: c.episodeName || `Эпизод ${c.position}`, releaseName: c.releaseName,
      dubberName: c.dubberName, sourceName: c.sourceName, totalEpisodes: c.totalEpisodes,
      titleOriginal: c.titleOriginal, animelibTeam: c.animelibTeam,
    }
  }
  // Предпочитаем ссылку, отданную хостом: для неё не нужен токен, гостю не надо входить
  let kodikUrl = c.kodikUrl || ''
  if (!kodikUrl) {
    const data = await getEpisodeTarget(c.releaseId, c.sourceId, c.position)
    const raw = data.episode?.url || ''
    if (!raw) throw new Error('Эпизод недоступен')
    kodikUrl = raw.startsWith('//') ? `https:${raw}` : raw
  }
  if (!isPlayableUrl(kodikUrl)) throw new Error('Источник не поддерживается плеером')
  return {
    kodikUrl, releaseId: c.releaseId, sourceId: c.sourceId, position: c.position,
    episodeName: c.episodeName || `Эпизод ${c.position}`, releaseName: c.releaseName,
    dubberName: c.dubberName, sourceName: c.sourceName, totalEpisodes: c.totalEpisodes,
    titleOriginal: c.titleOriginal,
  }
}

export default function PlayerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  // Гость приходит либо по публичной ссылке /room/:code, либо через ?room=CODE
  const roomParam = params.code || searchParams.get('room')
  const design = useDesign()

  const [state, setState] = useState<PlayerState | null>(location.state as PlayerState | null)
  // Карточка «похожее» после финала — только при одиночном просмотре.
  const [endCard, setEndCard] = useState<Release[] | null>(null)
  const [endTitle, setEndTitle] = useState('')
  const endTriggerRef = useRef<() => void>(() => {})
  const [loadingNext, setLoadingNext] = useState(false)
  const [nextError, setNextError] = useState('')

  // В приложении держим горизонталь на весь экран плеера: вызов из iframe на
  // Android срабатывает через раз.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {})
    Immersive.enable().catch(() => {})
    return () => {
      ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {})
      Immersive.disable().catch(() => {})
    }
  }, [])

  // Watch Together
  const roomRef = useRef<WatchRoom | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const lastPbRef = useRef<{ time: number; paused: boolean } | null>(null)
  // Защита от ответов, пришедших не по порядку: применяем только результат
  // последнего запроса, иначе отставший показал бы не ту серию.
  const contentRequestIdRef = useRef(0)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [role, setRole] = useState<'host' | 'guest' | null>(null)
  const [peers, setPeers] = useState(0)
  const [roomMsg, setRoomMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [joining, setJoining] = useState(false)
  const [queue, setQueue] = useState<WtContent[]>([])
  const [showQueue, setShowQueue] = useState(false)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const queueRef = useRef<WtContent[]>([])
  queueRef.current = queue

  const playerUrl = useMemo(() => {
    if (!state) return ''
    if (!state.kodikUrl && !state.animelibTeam) return ''
    const subtitle = [state.dubberName, state.sourceName, `серия ${state.position}`]
      .filter(Boolean).join(' · ')
    const params = new URLSearchParams({
      title: state.releaseName ?? state.episodeName,
      subtitle,
      releaseId: state.releaseId,
      sourceId: String(state.sourceId),
      position: String(state.position),
      design,
    })
    if (state.animelibTeam) params.set('animelibTeam', state.animelibTeam)
    else params.set('url', state.kodikUrl!)
    if (state.titleOriginal) params.set('origTitle', state.titleOriginal)
    if (state.markWatchedSourceId) params.set('markSourceId', String(state.markWatchedSourceId))
    const token = localStorage.getItem('anixart_token')
    if (token) params.set('token', token)
    const uid = localStorage.getItem('anixart_user_id')
    if (uid) params.set('userId', uid)
    return `${API_BASE}/api/v1/player?${params}`
  }, [state, design])

  // Сообщаем iframe его роль и последнее состояние — для поздно подключившихся
  const primeIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage({ __wt: 'role', role: roomRef.current?.role ?? 'host' }, API_BASE)
    if (roomRef.current?.role === 'guest' && lastPbRef.current) {
      win.postMessage({ __wt: 'apply', ...lastPbRef.current }, API_BASE)
    }
  }, [])

  // Отдаём в iframe состояние комнаты и соседних серий.
  const postMeta = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    if (!win || !state) return
    const hasNext = role !== 'guest' && (state.totalEpisodes == null || state.position < state.totalEpisodes)
    const hasPrev = role !== 'guest' && state.position > 1
    win.postMessage({ __wt: 'meta', hasNext, hasPrev, roomCode, role, peers }, API_BASE)
  }, [state, role, roomCode, peers])
  useEffect(() => { postMeta() }, [postMeta])

  // ── Правки очереди: истина у хоста, рассылаем её целиком ──
  const pushQueue = useCallback((q: WtContent[]) => {
    setQueue(q)
    roomRef.current?.sendQueue(q)
  }, [])
  const addToQueue = useCallback((item: WtContent) => { pushQueue([...queueRef.current, item]) }, [pushQueue])
  const removeFromQueue = useCallback((index: number) => { pushQueue(queueRef.current.filter((_, i) => i !== index)) }, [pushQueue])
  const playFromQueue = useCallback(async (index: number) => {
    const q = queueRef.current
    if (index < 0 || index >= q.length) return
    const item = q[index]
    const requestId = ++contentRequestIdRef.current
    try {
      const next = await resolveContent(item)
      if (requestId !== contentRequestIdRef.current) return
      pushQueue(q.filter((_, i) => i !== index))
      setState(next) // host content useEffect re-sends content to guests
    } catch { if (requestId === contentRequestIdRef.current) setRoomMsg('Не удалось включить из очереди') }
  }, [pushQueue])

  // Показываем «похожее» после последней серии, только вне комнаты.
  endTriggerRef.current = () => {
    if (!state || roomCode) return
    const isFinale = state.totalEpisodes != null && state.position >= state.totalEpisodes
    if (!isFinale) return
    setEndTitle(state.releaseName || '')
    setEndCard([])
    const rid = state.releaseId
    ;(async () => {
      try {
        const rel = (await getRelease(rid)).release
        setEndCard(rel ? await buildRecommendations(rel) : [])
      } catch { /* keep the empty card */ }
    })()
  }
  // Сбрасываем карточку при загрузке новой серии.
  useEffect(() => { setEndCard(null) }, [state?.releaseId, state?.position])

  // ── Мост postMessage с iframe плеера ──
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== API_BASE) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (typeof d.__player === 'string') { actionRef.current(d.__player, d); return }
      if (!d.__wt) return
      if (d.__wt === 'ready') { primeIframe(); postMeta(); return }
      if (d.__wt === 'state' && roomRef.current?.role === 'host') {
        roomRef.current.sendPlayback({ time: Number(d.time) || 0, paused: !!d.paused })
      }
      if (d.__wt === 'ended') endTriggerRef.current()
      if (d.__wt === 'ended' && roomRef.current?.role === 'host' && queueRef.current.length > 0) {
        playFromQueue(0)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [primeIframe, playFromQueue, postMeta])

  // Хост рассылает содержимое при каждой смене серии
  useEffect(() => {
    if (role === 'host' && state && roomRef.current) {
      roomRef.current.sendContent(contentOf(state))
    }
  }, [role, state])

  const buildHandlers = useCallback(() => ({
    onCreated: (code: string) => { setRoomCode(code); setRole('host'); setRoomMsg('') },
    onJoined: async (data: { content: WtContent | null; queue: WtContent[] }) => {
      setRole('guest'); setRoomMsg('Подключено. Ждём хоста…')
      setQueue(data.queue || [])
      if (data.content) {
        const requestId = ++contentRequestIdRef.current
        try {
          const next = await resolveContent(data.content)
          if (requestId !== contentRequestIdRef.current) return
          setState(next); setRoomMsg('')
        } catch { if (requestId === contentRequestIdRef.current) setRoomMsg('Не удалось загрузить серию') }
      }
    },
    onContent: async (c: WtContent) => {
      const requestId = ++contentRequestIdRef.current
      try {
        const next = await resolveContent(c)
        if (requestId !== contentRequestIdRef.current) return
        setState(next); setRoomMsg('')
      } catch { if (requestId === contentRequestIdRef.current) setRoomMsg('Не удалось загрузить серию') }
    },
    onPlayback: (pb: { time: number; paused: boolean; at?: number }) => {
      // Компенсируем время доставки сообщения: без этого гость стабильно
      // отстаёт ровно на него.
      const elapsedMs = roomRef.current?.estimateElapsedMs(pb.at) ?? 0
      const adjusted = { time: pb.paused ? pb.time : pb.time + elapsedMs / 1000, paused: pb.paused }
      lastPbRef.current = adjusted
      iframeRef.current?.contentWindow?.postMessage({ __wt: 'apply', ...adjusted }, API_BASE)
    },
    onQueue: (q: WtContent[]) => setQueue(q),
    onPeers: (count: number) => setPeers(count),
    onHostLeft: () => setRoomMsg('Хост вышел — комната закрыта'),
    onReconnecting: () => setRoomMsg('Переподключение…'),
    onReconnected: () => setRoomMsg(''),
    onReconnectFailed: () => setRoomMsg('Не удалось переподключиться — перезайди в комнату'),
    onError: (err: string) => {
      setJoining(false)
      setRoomMsg(err === 'no_room' ? 'Комната не найдена' : err === 'room_full' ? 'Комната заполнена' : 'Ошибка соединения')
    },
    onClose: () => { /* keep UI; reconnection is manual */ },
  }), [])

  // Автовход гостя по ?room=CODE
  useEffect(() => {
    if (!roomParam || roomRef.current) return
    setJoining(true)
    const room = new WatchRoom(buildHandlers())
    roomRef.current = room
    room.join(roomParam)
    setRoomCode(roomParam.toUpperCase())
    return () => { room.close(); roomRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam])

  useEffect(() => () => { roomRef.current?.close() }, [])

  const startRoom = () => {
    if (roomRef.current || !state) return
    const room = new WatchRoom(buildHandlers())
    roomRef.current = room
    room.create()
  }

  const leaveRoom = () => {
    roomRef.current?.close()
    roomRef.current = null
    setRoomCode(null); setRole(null); setPeers(0); setRoomMsg('')
    if (roomParam) navigate('/home')
  }

  const shareLink = roomCode ? `${window.location.origin}/room/${roomCode}` : ''
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  // Переход на серию по номеру. Общая механика для стрелок next/prev и панели серий;
  // тексты ошибок задаются вызывающим, чтобы «последняя серия» и «первая серия»
  // читались так же, как раньше.
  const goToEpisode = async (pos: number, msg?: { missing?: string; failed?: string }) => {
    if (!state || pos < 1) return
    setLoadingNext(true)
    setNextError('')
    try {
      let nextState: PlayerState
      if (state.animelibTeam) {
        // У AnimeLib ссылки заранее нет: /player сам резолвит команду и серию.
        nextState = {
          ...state, position: pos,
          episodeName: `Эпизод ${pos}`,
        }
      } else {
        // Озвучку могли сменить прямо в плеере — продолжаем в ней, а не в исходной.
        const sourceId = currentSource() ?? state.sourceId
        const dubberName = currentDubber()
        const data = await getEpisodeTarget(state.releaseId, sourceId, pos)
        const rawUrl = data.episode?.url || ''
        if (!rawUrl) { setNextError(msg?.missing ?? 'Серия недоступна'); return }
        const kodikUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
        if (!isPlayableUrl(kodikUrl)) { setNextError('Источник не поддерживается плеером'); return }
        nextState = {
          ...state, kodikUrl, position: pos, sourceId, dubberName,
          episodeName: data.episode?.name || `Эпизод ${pos}`,
        }
      }
      saveWatchProgress({
        releaseId: state.releaseId, releaseTitle: state.releaseName, sourceId: nextState.sourceId,
        sourceName: state.sourceName, typeName: nextState.dubberName, episodePosition: pos,
        episodeName: nextState.episodeName, updatedAt: Date.now(),
      })
      setState(nextState) // iframe reloads (key) + host useEffect re-sends content
    } catch {
      setNextError(msg?.failed ?? 'Не удалось загрузить серию')
    } finally {
      setLoadingNext(false)
    }
  }

  const goToNext = () => {
    if (!state) return
    goToEpisode(state.position + 1, {
      missing: 'Это последняя серия', failed: 'Не удалось загрузить следующую серию',
    })
  }

  const goToPrev = () => {
    if (!state || role === 'guest' || state.position <= 1) return
    goToEpisode(state.position - 1, {
      missing: 'Это первая серия', failed: 'Не удалось загрузить предыдущую серию',
    })
  }

  // Поворот экрана кнопкой в плеере, только в приложении.
  const orientRef = useRef<'landscape' | 'portrait'>('landscape')
  const toggleOrientation = () => {
    if (!Capacitor.isNativePlatform()) return
    const next = orientRef.current === 'landscape' ? 'portrait' : 'landscape'
    orientRef.current = next
    ScreenOrientation.lock({ orientation: next }).catch(() => {})
  }

  // Намерения из плеера: назад, соседние серии, комната, очередь, поворот.
  // Смена озвучки происходит ВНУТРИ iframe и намеренно не идёт через setState:
  // playerUrl содержит sourceId, а у iframe key={playerUrl} — любое изменение
  // состояния перемонтировало бы его и сбросило воспроизведение, ради чего всё
  // и затевалось. Поэтому держим живой sourceId в ref и подмешиваем его там,
  // где он действительно нужен: переход по сериям и запись прогресса.
  const liveDubRef = useRef<{ sourceId: number; dubberName?: string } | null>(null)
  const currentSource = () => liveDubRef.current?.sourceId ?? state?.sourceId
  const currentDubber = () => liveDubRef.current?.dubberName ?? state?.dubberName
  // Новая серия грузится уже в выбранной озвучке, поэтому ref обнуляем при её смене.
  useEffect(() => { liveDubRef.current = null }, [state?.releaseId, state?.position])

  const actionRef = useRef<(action: string, data?: Record<string, unknown>) => void>(() => {})
  actionRef.current = (action: string, data?: Record<string, unknown>) => {
    switch (action) {
      case 'dub':
        if (typeof data?.sourceId === 'number') {
          liveDubRef.current = {
            sourceId: data.sourceId,
            dubberName: typeof data.dubberName === 'string' ? data.dubberName : undefined,
          }
        }
        break
      case 'back': roomCode ? leaveRoom() : navigate(-1); break
      case 'next': goToNext(); break
      case 'prev': goToPrev(); break
      case 'together': roomCode ? copyLink() : startRoom(); break
      case 'queue': setShowQueue(true); break
      case 'episodes': setShowEpisodes(true); break
      case 'rotate': toggleOrientation(); break
    }
  }

  // Сами убираем разовые ошибки загрузки серии.
  useEffect(() => {
    if (!nextError) return
    const t = window.setTimeout(() => setNextError(''), 2600)
    return () => window.clearTimeout(t)
  }, [nextError])

  // Гость ждёт содержимое, играть пока нечего
  if (!state || !playerUrl) {
    if (roomParam) {
      return (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="text-2xl font-display">Совместный просмотр</div>
          <div className="text-sm text-muted">Комната <span className="text-accent font-mono">{roomCode}</span></div>
          <div className="text-sm text-muted">{roomMsg || 'Подключение…'}</div>
          <button onClick={leaveRoom} className="btn-ghost mt-2">Выйти</button>
        </div>
      )
    }
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4 text-sm">Нет данных для воспроизведения</p>
        <button onClick={() => navigate(-1)} className="btn-ghost">← Вернуться назад</button>
      </div>
    )
  }

  // Снаружи никакой обвязки: все кнопки внутри iframe, а наружу он шлёт намерения.
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* transient status: room connection + episode-nav errors (bar is gone) */}
      {(roomMsg || nextError || (copied && roomCode)) && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-[60] flex flex-col items-center gap-2 pointer-events-none">
          {copied && roomCode && <span className="px-4 py-2 rounded-full bg-black/80 text-accent text-sm border border-accent/30">✓ Ссылка скопирована</span>}
          {roomMsg && <span className="px-4 py-2 rounded-full bg-black/80 text-white text-sm border border-white/15">{roomMsg}</span>}
          {nextError && <span className="px-4 py-2 rounded-full bg-black/80 text-white text-sm border border-white/15">{nextError}</span>}
        </div>
      )}

      {showQueue && (
        role === 'host' ? (
          <QueuePanel
            queue={queue}
            onAdd={addToQueue}
            onRemove={removeFromQueue}
            onPlayNow={playFromQueue}
            onClose={() => setShowQueue(false)}
          />
        ) : (
          // Гостю очередь показывается только на чтение
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setShowQueue(false)}>
            <div className="w-full max-w-md h-full bg-[#0e0b16] border-l border-white/10 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="font-display text-lg">Очередь</div>
                <span className="text-xs text-muted">{queue.length}</span>
                <button onClick={() => setShowQueue(false)} className="btn-ghost ml-auto !py-1 !px-2">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {queue.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] text-sm">
                    <span className="text-muted">{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="truncate">{q.releaseName || q.releaseId}</div>
                      <div className="text-xs text-muted truncate">{[q.dubberName, q.sourceName, `серия ${q.position}`].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
                {queue.length === 0 && <div className="text-sm text-muted">Очередь пуста</div>}
              </div>
            </div>
          </div>
        )
      )}

      {showEpisodes && (
        <EpisodesPanel
          releaseId={state.releaseId}
          typeId={state.typeId}
          sourceId={state.sourceId}
          position={state.position}
          totalEpisodes={state.totalEpisodes}
          readOnly={role === 'guest'}
          onPick={(pos) => { setShowEpisodes(false); goToEpisode(pos) }}
          onClose={() => setShowEpisodes(false)}
        />
      )}

      <iframe
        ref={iframeRef}
        key={playerUrl}
        src={playerUrl}
        onLoad={primeIframe}
        className="absolute inset-0 w-full h-full border-0 bg-black"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
      />

      {endCard && (
        <div className="fixed inset-0 z-[65] bg-black/92 backdrop-blur-sm flex flex-col p-5 sm:p-10 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">
            <p className="text-accent text-sm font-semibold mb-1">Вы досмотрели</p>
            <h2 className="text-xl sm:text-2xl font-bold mb-6">{endTitle}</h2>
            {endCard.length > 0 ? (
              <>
                <h3 className="text-xs uppercase tracking-wide text-muted mb-3">Ещё похожее</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                  {endCard.map((r) => (
                    <button key={r.id} onClick={() => { setEndCard(null); navigate(`/release/${r.id}`) }} className="text-left group">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/[0.05] border border-white/[0.06] group-hover:border-accent/40 transition-colors">
                        {r.image && <img src={img(r.image)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-[11px] mt-1.5 line-clamp-2 text-text/85 leading-snug">{r.title_ru}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Подбираем похожее…</p>
            )}
            <div className="flex gap-2 mt-7">
              <button onClick={() => { setEndCard(null); if (state) navigate(`/release/${state.releaseId}`) }} className="btn-primary">К релизу</button>
              <button onClick={() => setEndCard(null)} className="btn-ghost">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
