import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getRelease,
  genreList,
  buildRecommendations,
  resolveReleaseRelatedAnime,
  resolveReleaseSimilarAnime,
  getMyRating,
  setMyRating,
  clearMyRating,
  getRelatedReleases,
  hasGrade,
} from '../api/releases'
import { toggleFavorite, setListStatus } from '../api/bookmarks'
import { getWatchProgress, getReleaseProgress } from '../api/episodes'
import type { WatchProgressEntry } from '../api/episodes'
import { getDiary, saveDiary } from '../api/diary'
import { resumeWatch } from '../lib/resume'
import DOMPurify from 'dompurify'
import type { Release, LinkedAnime } from '../api/releases'
import Spinner from '../components/Spinner'
import ReleaseCard from '../components/ReleaseCard'
import { img } from '../lib/img'
import { useDesign } from '../lib/design'
import '../styles/modern-release.css'

// Horizontal row of real Anixart releases (clickable → /release/:id)
function NativeRow({ title, items }: { title: string; items: Release[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map(r => (
          <div key={r.id} className="w-32 sm:w-36 shrink-0">
            <ReleaseCard release={r} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenshotsRow({ images }: { images: string[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold mb-4">Кадры</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {images.map((src, i) => (
          <a key={i} href={img(src)} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={img(src)} alt="" loading="lazy"
              className="h-32 sm:h-40 rounded-lg object-cover hover:opacity-90 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  )
}

const LIST_NAMES: Record<number, string> = {
  1: 'Смотрю',
  2: 'В планах',
  3: 'Просмотрено',
  4: 'Отложено',
  5: 'Брошено',
}

const WATCH_ORDER_KIND: Record<string, string> = {
  tv: 'ТВ',
  movie: 'Фильм',
  ova: 'OVA',
  ona: 'ONA',
  special: 'Спецвыпуск',
  tv_special: 'ТВ-спецвыпуск',
  music: 'Клип',
}

function stripRelatedAnimeFromNote(note?: string) {
  if (!note) return note
  return note
    .replace(/<!-- related-anime:start -->[\s\S]*?<!-- related-anime:end -->/g, '')
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    .trim()
}

// Sanitize third-party (Anixart) note HTML with DOMPurify — defends against
// stored XSS from release notes rendered via dangerouslySetInnerHTML.
function sanitizeNoteHtml(html?: string) {
  if (!html) return ''
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'br', 'em', 'i', 'li', 'ol', 'p', 'small', 'strong', 'ul'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  })
  // Force safe link behaviour
  return clean.replace(/<a /gi, '<a target="_blank" rel="noreferrer noopener" ')
}

function LinkedAnimeGrid({
  title,
  items,
  navigate,
  compact = false,
}: {
  title: string
  items: LinkedAnime[]
  navigate: ReturnType<typeof useNavigate>
  compact?: boolean
}) {
  if (items.length === 0) return null

  return (
    <div className="panel p-5 sm:p-6 mt-8">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      <div className={compact ? 'grid grid-cols-3 md:grid-cols-5 gap-3' : 'grid grid-cols-2 md:grid-cols-3 gap-4'}>
        {items.map((anime) => {
          const linked = anime.internalRelease
          const poster = img(linked?.image)
          return (
            <a
              key={`${anime.id}-${anime.url}`}
              href={anime.internalReleaseId ? `/release/${anime.internalReleaseId}` : anime.url}
              target={anime.internalReleaseId ? undefined : '_blank'}
              rel={anime.internalReleaseId ? undefined : 'noreferrer'}
              onClick={(event) => {
                if (anime.internalReleaseId) {
                  event.preventDefault()
                  navigate(`/release/${anime.internalReleaseId}`)
                }
              }}
              className={`group overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-accent/40 transition-colors ${compact ? 'rounded-xl' : 'rounded-2xl'}`}
            >
              <div className="aspect-[2/3] bg-white/[0.03]">
                {poster ? (
                  <img src={poster} alt={anime.russian || anime.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted px-3 text-center">
                    {anime.russian || anime.name}
                  </div>
                )}
              </div>
              <div className={compact ? 'p-2.5' : 'p-3'}>
                <div className={`${compact ? 'text-xs' : 'text-sm'} text-text/90 line-clamp-2`}>
                  {anime.russian || anime.name}
                </div>
                {anime.relationText && (
                  <div className="mt-1 text-xs text-muted line-clamp-1">{anime.relationText}</div>
                )}
                <div className={`mt-2 ${compact ? 'text-[10px]' : 'text-[11px]'} ${anime.internalReleaseId ? 'text-accent-soft' : 'text-muted'}`}>
                  {anime.internalReleaseId ? '▶ Смотреть на сайте' : 'Откроется на Shikimori ↗'}
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function ReleasePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const design = useDesign()
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [listStatus, setListStatusState] = useState<number>(0)
  const [myVote, setMyVote] = useState(0)
  const [listMenuOpen, setListMenuOpen] = useState(false)
  const [relatedAnime, setRelatedAnime] = useState<LinkedAnime[]>([])
  const [similarAnime, setSimilarAnime] = useState<LinkedAnime[]>([])
  const [relatedFull, setRelatedFull] = useState<Release[]>([])
  const [recommended, setRecommended] = useState<Release[]>([])
  const [resuming, setResuming] = useState(false)
  // Cross-device last-watched episode (Anixart account history + local fallback).
  const [watchProgress, setWatchProgress] = useState<WatchProgressEntry | null>(null)
  // Personal diary: review text + private 1–10 score (stored on the gateway).
  const [diaryText, setDiaryText] = useState('')
  const [diaryRating, setDiaryRating] = useState(0)
  const [diarySaving, setDiarySaving] = useState(false)
  const [diarySaved, setDiarySaved] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getRelease(id)
      .then(data => {
        const r = data.release || (Array.isArray(data.content) ? data.content[0] : data.content?.content?.[0]) || null
        setRelease(r)
        if (r) {
          setIsFavorite(!!r.is_favorite)
          setListStatusState(r.profile_list_status || 0)
        }
      })
      .finally(() => setLoading(false))
    // Personal 1–10 rating lives on our own server, not Anixart.
    getMyRating(Number(id)).then(setMyVote).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!release) return
    let cancelled = false

    Promise.all([
      resolveReleaseRelatedAnime(release),
      resolveReleaseSimilarAnime(release),
    ]).then(([related, similar]) => {
      if (!cancelled) {
        setRelatedAnime(related)
        setSimilarAnime(similar.filter((item) => item.internalReleaseId !== release.id))
      }
    }).catch(() => {
      if (!cancelled) {
        setRelatedAnime([])
        setSimilarAnime([])
      }
    })

    // Same "more like this" recommendations shown at the end of a finale.
    setRecommended([])
    buildRecommendations(release)
      .then(items => { if (!cancelled) setRecommended(items) })
      .catch(() => { /* falls back to "Похожее аниме" */ })

    // Full franchise list (release.related_releases is only a 3-item preview)
    setRelatedFull([])
    if (release.related?.id) {
      getRelatedReleases(release.related.id)
        .then(items => { if (!cancelled) setRelatedFull(items.filter(r => r.id !== release.id)) })
        .catch(() => { /* keep empty → falls back to preview */ })
    }

    return () => {
      cancelled = true
    }
  }, [release])

  // Populate the "Продолжить" button from the cross-device source (account
  // history), seeding the local value instantly so it doesn't flash.
  useEffect(() => {
    if (!release) return
    setWatchProgress(getWatchProgress(release.id))
    let cancelled = false
    getReleaseProgress(release.id).then((p) => { if (!cancelled && p) setWatchProgress(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [release])

  // Load the personal diary entry for this release.
  useEffect(() => {
    if (!release) return
    let cancelled = false
    getDiary(release.id).then((e) => {
      if (cancelled || !e) return
      setDiaryText(e.text || '')
      setDiaryRating(e.rating || 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [release])

  const submitDiary = async () => {
    if (!release) return
    setDiarySaving(true)
    try {
      await saveDiary(release.id, diaryText, diaryRating)
      setDiarySaved(true)
      setTimeout(() => setDiarySaved(false), 1800)
    } finally {
      setDiarySaving(false)
    }
  }

  // Resume straight into the player instead of the episode-selection screen
  const handleContinue = async (progress: NonNullable<ReturnType<typeof getWatchProgress>>) => {
    if (!release) return
    setResuming(true)
    try {
      await resumeWatch(navigate, {
        ...progress,
        releaseTitle: progress.releaseTitle || release.title_ru,
        releaseImage: progress.releaseImage || release.image,
      })
    } finally {
      setResuming(false)
    }
  }

  const handleVote = async (vote: number) => {
    if (!release) return
    const prev = myVote
    const next = prev === vote ? 0 : vote
    setMyVote(next) // optimistic
    try {
      if (next === 0) await clearMyRating(release.id)
      else await setMyRating(release.id, next)
    } catch {
      setMyVote(prev) // revert on failure
    }
  }

  const handleFavorite = async () => {
    if (!release) return
    const prev = isFavorite
    setIsFavorite(!prev) // optimistic
    try {
      await toggleFavorite(release.id, prev)
    } catch {
      setIsFavorite(prev) // revert on failure
    }
  }

  const handleListStatus = async (listId: number) => {
    if (!release) return
    const prev = listStatus
    const next = prev === listId ? 0 : listId
    setListStatusState(next) // optimistic
    try {
      await setListStatus(release.id, listId, prev)
    } catch {
      setListStatusState(prev) // revert on failure
    }
  }

  if (loading) return <Spinner variant="release" />
  if (!release) return <div className="text-center text-muted py-20 text-sm">Релиз не найден</div>

  const poster = img(release.image || '')
  const genres = genreList(release.genres)
  const cleanedNote = stripRelatedAnimeFromNote(release.note)
  const safeNoteHtml = sanitizeNoteHtml(cleanedNote)
  const canWatch = !release.is_play_disabled
  const hasOriginalTitle = release.title_original && release.title_original !== release.title_ru && release.title_original !== release.title_en

  const meta: Array<[string, React.ReactNode]> = []
  if (release.year) meta.push(['Год', release.year])
  const statusLabel = { 1: 'Онгоинг', 2: 'Вышел', 3: 'Анонс' }[release.status_id ?? 0]
  if (statusLabel) meta.push(['Статус', statusLabel])
  if (release.studio) {
    meta.push([
      'Студия',
      <button
        className="text-accent-soft hover:underline"
        onClick={() => navigate(`/search?q=${encodeURIComponent(release.studio!)}`)}
      >
        {release.studio}
      </button>,
    ])
  }
  if (hasGrade(release))
    meta.push(['Рейтинг', (
      <span>
        <span className="text-accent-soft font-semibold">{release.grade!.toFixed(2)}</span>
        {release.vote_count ? <span className="text-muted"> · {release.vote_count.toLocaleString('ru')} оценок</span> : null}
      </span>
    )])
  if (release.your_vote && release.your_vote > 0)
    meta.push(['Твоя оценка', <span className="text-accent-soft font-semibold">{release.your_vote}</span>])
  if (release.episodes_released !== undefined)
    meta.push(['Эпизоды', `${release.episodes_released}${release.episodes_total ? ` / ${release.episodes_total}` : ''}`])
  if (release.duration) meta.push(['Длительность', `${release.duration} мин`])

  const noteOnly = safeNoteHtml && cleanedNote !== release.description ? safeNoteHtml : ''

  const relatedItems: Array<{ key: string; title: string; sub?: string; href: string; poster?: string; onClick?: () => void }> =
    relatedFull.length > 0
      ? relatedFull.map(r => ({ key: `rf-${r.id}`, title: r.title_ru, href: `/release/${r.id}`, poster: img(r.image) }))
      : release.related_releases && release.related_releases.length > 0
        ? release.related_releases.map(r => ({ key: `rr-${r.id}`, title: r.title_ru, href: `/release/${r.id}`, poster: img(r.image) }))
        : relatedAnime.map(a => ({
            key: `ra-${a.id}-${a.url}`,
            title: a.russian || a.name,
            sub: a.relationText,
            href: a.internalReleaseId ? `/release/${a.internalReleaseId}` : a.url,
            poster: img(a.internalRelease?.image),
            onClick: a.internalReleaseId ? () => navigate(`/release/${a.internalReleaseId}`) : undefined,
          }))

  const similarItems: Array<{ key: string; title: string; sub?: string; href: string; poster?: string; onClick?: () => void }> =
    recommended.length > 0
      ? recommended.map(r => ({ key: `rc-${r.id}`, title: r.title_ru, href: `/release/${r.id}`, poster: img(r.image) }))
      : similarAnime.map(a => ({
          key: `sa-${a.id}-${a.url}`,
          title: a.russian || a.name,
          sub: a.relationText,
          href: a.internalReleaseId ? `/release/${a.internalReleaseId}` : a.url,
          poster: img(a.internalRelease?.image),
          onClick: a.internalReleaseId ? () => navigate(`/release/${a.internalReleaseId}`) : undefined,
        }))

  const renderModernTrack = (items: typeof relatedItems) => (
    <div className="mdk-track">
      {items.map(it => (
        <a
          key={it.key}
          href={it.href}
          target={it.href.startsWith('http') ? '_blank' : undefined}
          rel={it.href.startsWith('http') ? 'noreferrer' : undefined}
          onClick={(e) => { if (it.onClick) { e.preventDefault(); it.onClick() } }}
          className="mdk-card"
        >
          <div className="mdk-poster" style={it.poster ? { backgroundImage: `url(${it.poster})` } : undefined} />
          <div className="mdk-ct">{it.title}</div>
          {it.sub && <div className="mdk-cs">{it.sub}</div>}
        </a>
      ))}
    </div>
  )

  if (design === 'modern') {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mdp-release-backdrop" />

        <button
          onClick={() => navigate(-1)}
          className="text-sm text-muted hover:text-text transition-colors mb-4 inline-flex items-center gap-1 relative"
        >
          ← Назад
        </button>

        <div className="mdp-release-head">
          {poster ? (
            <img src={poster} alt={release.title_ru} className="mdp-release-pos" />
          ) : (
            <div className="mdp-release-pos mdk-glass flex items-center justify-center text-muted/60 text-xs">Нет постера</div>
          )}
          <div className="min-w-0">
            <h1 className="font-display">{release.title_ru}</h1>
            {release.title_en && <p className="text-muted text-sm mt-1">{release.title_en}</p>}
            <div className="mdp-release-titmeta">
              {hasGrade(release) && (
                <span className="mdk-chip mdk-chip-solid">★ {release.grade!.toFixed(2)}</span>
              )}
              {release.year && <span className="mdk-chip">{release.year}</span>}
              {release.episodes_released !== undefined && (
                <span className="mdk-chip">{release.episodes_released}{release.episodes_total ? ` / ${release.episodes_total}` : ''} серий</span>
              )}
              {genres.slice(0, 4).map(g => (
                <button key={g} className="mdk-chip" onClick={() => navigate(`/search?q=${encodeURIComponent(g)}`)}>{g}</button>
              ))}
            </div>
            <div className="mdp-release-cta">
              <button onClick={() => navigate(`/watch/${release.id}`)} disabled={!canWatch} className="mdk-btn mdk-btn-primary">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> {canWatch ? 'Смотреть' : 'Недоступно'}
              </button>
              {watchProgress && canWatch && (
                <button onClick={() => handleContinue(watchProgress)} disabled={resuming} className="mdk-btn mdk-btn-ghost">
                  ▸ {resuming ? 'Загрузка…' : `Продолжить · серия ${watchProgress.episodePosition}`}
                </button>
              )}
              <button onClick={handleFavorite} className="mdk-btn mdk-btn-ghost">{isFavorite ? '★ В избранном' : '☆ В избранное'}</button>
              <div className="relative">
                <button onClick={() => { if (!listStatus) handleListStatus(1); else setListMenuOpen(o => !o) }} className="mdk-btn mdk-btn-ghost">
                  {listStatus ? LIST_NAMES[listStatus] : '+ Список'} ▾
                </button>
                {listMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setListMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 z-20 w-52 rounded-2xl border border-white/[0.1] bg-[#14111f] p-1.5 shadow-glow">
                      {Object.entries(LIST_NAMES).map(([lid, name]) => {
                        const idNum = parseInt(lid)
                        const active = listStatus === idNum
                        return (
                          <button key={idNum} onClick={() => { handleListStatus(idNum); setListMenuOpen(false) }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${active ? 'bg-accent/15 text-accent' : 'text-text/85 hover:bg-white/[0.05]'}`}>
                            {name}{active && <span className="text-xs">✓</span>}
                          </button>
                        )
                      })}
                      {listStatus > 0 && (
                        <button onClick={() => { handleListStatus(listStatus); setListMenuOpen(false) }}
                          className="w-full text-left px-3 py-2 mt-1 rounded-lg text-sm text-red-300/90 hover:bg-red-500/10 border-t border-white/[0.06]">
                          Убрать из списка
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mdp-release-layout">
          <div>
            {release.description && (
              <div className="mdk-glass mdk-pad">
                <h3 className="mb-2">Описание</h3>
                <p className="text-sm text-text/80 leading-relaxed whitespace-pre-line">{release.description}</p>
              </div>
            )}

            {noteOnly && (
              <div className="mdk-glass mdk-pad mt-4">
                <h3 className="mb-2">Дополнительно</h3>
                <div className="text-sm text-text/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: noteOnly }} />
              </div>
            )}

            {release.screenshot_images && release.screenshot_images.length > 0 && (
              <>
                <div className="mdk-rowhead"><h2>Кадры</h2></div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {release.screenshot_images.map((src, i) => (
                    <a key={i} href={img(src)} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={img(src)} alt="" loading="lazy" className="h-36 rounded-xl object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              </>
            )}

            {release.watch_order && release.watch_order.length > 1 && (
              <>
                <div className="mdk-rowhead"><h2>Порядок просмотра</h2></div>
                <div className="mdk-glass mdk-pad flex flex-col gap-0.5">
                  {release.watch_order.map((n, i) => (
                    <button key={n.id} onClick={() => !n.current && navigate(`/search?q=${encodeURIComponent(n.name)}`)} disabled={n.current}
                      className="flex gap-3 items-center py-2 px-1 text-left">
                      <span className={`mdk-chip ${n.current ? 'mdk-chip-acc' : ''}`} style={{ width: 26, height: 26, justifyContent: 'center', padding: 0 }}>{i + 1}</span>
                      <span>
                        <span className="block text-sm font-medium">{n.name}</span>
                        <span className="block text-[11px] text-muted">
                          {[WATCH_ORDER_KIND[n.kind || ''] || n.kind, n.year].filter(Boolean).join(' · ')}
                          {n.current ? ' · вы здесь' : ' · найти ›'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mdk-glass mdk-pad mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3>Мой дневник</h3>
                <div className="flex items-center gap-1 mdp-release-stars">
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <i key={n} className={n <= diaryRating ? 'on' : ''} onClick={() => setDiaryRating(n === diaryRating ? 0 : n)}>★</i>
                  ))}
                  <span className="text-sm text-muted ml-1.5 w-10">{diaryRating ? `${diaryRating}/10` : ''}</span>
                </div>
              </div>
              <textarea
                value={diaryText}
                onChange={(e) => setDiaryText(e.target.value)}
                maxLength={8000}
                rows={4}
                placeholder="Личные впечатления, мысли, цитаты… (видно только тебе)"
                className="w-full resize-y rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-text placeholder:text-muted/70 outline-none focus:border-accent/50"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted">{diaryText.length}/8000 · приватно</span>
                <button onClick={submitDiary} disabled={diarySaving} className="mdk-btn mdk-btn-primary !py-2 !px-5 text-sm">
                  {diarySaving ? 'Сохраняю…' : diarySaved ? 'Сохранено ✓' : 'Сохранить'}
                </button>
              </div>
            </div>

            {relatedItems.length > 0 && (
              <>
                <div className="mdk-rowhead"><h2>Связанные релизы</h2></div>
                {renderModernTrack(relatedItems)}
              </>
            )}
            {similarItems.length > 0 && (
              <>
                <div className="mdk-rowhead"><h2>{recommended.length > 0 ? 'Рекомендации' : 'Похожее аниме'}</h2></div>
                {renderModernTrack(similarItems)}
              </>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="mdk-glass mdk-pad">
              <h3 className="mb-3">Моя оценка</h3>
              <div className="mdp-release-stars">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <i key={n} className={n <= myVote ? 'on' : ''} onClick={() => handleVote(n)} title={`${n} из 10`}>★</i>
                ))}
              </div>
              {myVote > 0 && <div className="text-sm text-accent-soft mt-1">{myVote}/10</div>}
              {hasGrade(release) && (
                <div className="text-muted text-xs mt-2">
                  Оценка сообщества: <b className="text-text">{release.grade!.toFixed(2)}</b>
                  {release.vote_count ? ` · ${release.vote_count.toLocaleString('ru')} голосов` : ''}
                </div>
              )}
            </div>

            {meta.length > 0 && (
              <div className="mdk-glass mdk-pad mdp-release-info">
                <h3 className="mb-2">О тайтле</h3>
                {meta.map(([k, v], i) => (
                  <div className="r" key={i}><b>{k}</b><span>{v}</span></div>
                ))}
              </div>
            )}

            {release.trailer?.url && (
              <div className="mdk-glass mdk-pad">
                <h3 className="mb-2">Трейлер</h3>
                <a href={release.trailer.url} target="_blank" rel="noreferrer"
                  className="group relative block w-full aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/[0.09]">
                  {release.trailer.image && (
                    <img src={release.trailer.image} alt={release.trailer.name || 'Трейлер'} loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-accent text-[#130d1c] flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform">▶</span>
                  </span>
                </a>
              </div>
            )}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {poster && (
        <div className="fixed left-0 right-0 top-14 h-[460px] -z-10 overflow-hidden pointer-events-none">
          <img
            src={poster}
            alt=""
            className="w-full h-full object-cover scale-110"
            style={{ filter: 'blur(44px) saturate(1.25)', opacity: 0.4 }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(7,6,11,0.35), rgba(7,6,11,0.8) 55%, #07060b 100%)' }}
          />
        </div>
      )}

      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text transition-colors mb-6 inline-flex items-center gap-1"
      >
        ← Назад
      </button>

      <div className="flex gap-6 sm:gap-8 flex-col sm:flex-row">
        <div className="shrink-0 mx-auto sm:mx-0">
          {poster ? (
            <img src={poster} alt={release.title_ru}
                 className="w-44 sm:w-52 aspect-[2/3] object-cover rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]" />
          ) : (
            <div className="w-44 sm:w-52 aspect-[2/3] panel flex items-center justify-center text-muted/60 text-xs">
              Нет постера
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6 lg:gap-10">
         <div className="lg:max-w-md lg:shrink-0">
          <h1 className="text-3xl sm:text-4xl font-bold leading-[1.1]">{release.title_ru}</h1>
          {release.title_en && <p className="text-muted text-sm mt-1">{release.title_en}</p>}
          {hasOriginalTitle && <p className="text-muted/80 text-sm mt-1">{release.title_original}</p>}
          {release.title_alt &&
            ![release.title_ru, release.title_en, release.title_original].includes(release.title_alt) && (
            <p className="text-muted/80 text-sm mt-1">{release.title_alt}</p>
          )}

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {genres.map(g => (
                <button
                  key={g}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(g)}`)}
                  className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-muted hover:text-text hover:border-white/15"
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {meta.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5 text-sm max-w-sm">
              {meta.map(([k, v], i) => (
                <div key={i} className="flex justify-between gap-2 border-b border-white/[0.05] pb-1.5">
                  <span className="text-muted">{k}</span>
                  <span className="text-text/90 text-right truncate">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={() => navigate(`/watch/${release.id}`)}
              disabled={!canWatch}
              className="btn-primary"
            >
              {canWatch ? '▶ Смотреть' : 'Просмотр недоступен'}
            </button>
            {watchProgress && canWatch && (
              <button
                onClick={() => handleContinue(watchProgress)}
                disabled={resuming}
                className="btn-ghost flex flex-col items-center !py-1.5 leading-tight"
              >
                <span>{resuming ? 'Загрузка…' : 'Продолжить'}</span>
                <span className="text-[11px] font-normal text-muted">серия {watchProgress.episodePosition}</span>
              </button>
            )}
            <button
              onClick={handleFavorite}
              className={`btn-ghost ${isFavorite ? '!border-yellow-500/50 !text-yellow-400 !bg-yellow-500/10' : ''}`}
            >
              {isFavorite ? '★ В избранном' : '☆ В избранное'}
            </button>
          </div>

          <div className="relative inline-block mt-4">
            <div className="flex">
              <button
                onClick={() => { if (!listStatus) handleListStatus(1); else setListMenuOpen(o => !o) }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-l-xl text-sm font-semibold transition-colors
                  ${listStatus ? 'bg-accent text-[#130d1c] hover:bg-accent-soft' : 'bg-white/[0.05] border border-white/[0.08] border-r-0 text-text/85 hover:bg-white/[0.08]'}`}
              >
                {listStatus ? LIST_NAMES[listStatus] : '+ Добавить в список'}
              </button>
              <button
                onClick={() => setListMenuOpen(o => !o)}
                aria-label="Выбрать список"
                className={`px-2.5 rounded-r-xl text-sm transition-colors
                  ${listStatus ? 'bg-accent text-[#130d1c] hover:bg-accent-soft border-l border-black/15' : 'bg-white/[0.05] border border-white/[0.08] text-muted hover:bg-white/[0.08]'}`}
              >
                ▾
              </button>
            </div>

            {listMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setListMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-20 w-52 rounded-2xl border border-white/[0.1] bg-[#14111f] p-1.5 shadow-glow">
                  {Object.entries(LIST_NAMES).map(([lid, name]) => {
                    const idNum = parseInt(lid)
                    const active = listStatus === idNum
                    return (
                      <button
                        key={idNum}
                        onClick={() => { handleListStatus(idNum); setListMenuOpen(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                          ${active ? 'bg-accent/15 text-accent' : 'text-text/85 hover:bg-white/[0.05]'}`}
                      >
                        {name}
                        {active && <span className="text-xs">✓</span>}
                      </button>
                    )
                  })}
                  {listStatus > 0 && (
                    <button
                      onClick={() => { handleListStatus(listStatus); setListMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 mt-1 rounded-lg text-sm text-red-300/90 hover:bg-red-500/10 border-t border-white/[0.06]"
                    >
                      Убрать из списка
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-0.5 mt-5">
            <span className="text-sm text-muted mr-2">Моя оценка:</span>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => handleVote(n)}
                className={`text-xl leading-none transition-colors ${n <= myVote ? 'text-yellow-400' : 'text-white/15 hover:text-yellow-400/50'}`}
                title={`${n} из 10`}
              >
                ★
              </button>
            ))}
            {myVote > 0 && <span className="text-sm text-muted ml-2">{myVote}/10</span>}
          </div>
         </div>

          {release.description && (
            <div className="flex-1 min-w-0 mt-2 lg:mt-0">
              <h2 className="text-base font-semibold mb-2">Описание</h2>
              <p className="text-sm text-text/80 leading-relaxed whitespace-pre-line">{release.description}</p>
            </div>
          )}
        </div>
      </div>

      {noteOnly && (
        <div className="panel p-5 sm:p-6 mt-8">
          <h2 className="text-base font-semibold mb-3">Дополнительно</h2>
          <div className="text-sm text-text/80 leading-relaxed"
               dangerouslySetInnerHTML={{ __html: noteOnly }} />
        </div>
      )}

      {release.screenshot_images && release.screenshot_images.length > 0 && (
        <ScreenshotsRow images={release.screenshot_images} />
      )}

      {/* Trailer / PV (Shikimori) — opens on YouTube */}
      {release.trailer?.url && (
        <div className="panel p-5 sm:p-6 mt-8">
          <h2 className="text-base font-semibold mb-3">Трейлер</h2>
          <a
            href={release.trailer.url}
            target="_blank"
            rel="noreferrer"
            className="group relative block w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/[0.06]"
          >
            {release.trailer.image && (
              <img src={release.trailer.image} alt={release.trailer.name || 'Трейлер'} loading="lazy"
                   className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full bg-accent/90 text-[#130d1c] flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">▶</span>
            </span>
          </a>
          {release.trailer.name && <p className="text-xs text-muted mt-2 truncate max-w-md">{release.trailer.name}</p>}
        </div>
      )}

      {/* Franchise watch order (Shikimori) */}
      {release.watch_order && release.watch_order.length > 1 && (
        <div className="panel p-5 sm:p-6 mt-8">
          <h2 className="text-base font-semibold mb-1">Порядок просмотра</h2>
          <p className="text-xs text-muted mb-4">Хронология франшизы по данным Shikimori</p>
          <ol className="space-y-1.5">
            {release.watch_order.map((n, i) => (
              <li key={n.id}>
                <button
                  onClick={() => !n.current && navigate(`/search?q=${encodeURIComponent(n.name)}`)}
                  disabled={n.current}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${n.current ? 'bg-accent/[0.12] border border-accent/30' : 'hover:bg-white/[0.05] border border-transparent'}`}
                >
                  <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${n.current ? 'bg-accent text-[#130d1c]' : 'bg-white/[0.06] text-muted'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm truncate ${n.current ? 'text-accent font-semibold' : 'text-text/90'}`}>{n.name}</span>
                    <span className="block text-[11px] text-muted">
                      {[WATCH_ORDER_KIND[n.kind || ''] || n.kind, n.year].filter(Boolean).join(' · ')}
                      {n.current && ' · вы здесь'}
                    </span>
                  </span>
                  {!n.current && <span className="text-muted text-xs shrink-0">найти ›</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Personal diary: review + private score */}
      <div className="panel p-5 sm:p-6 mt-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">Мой дневник</h2>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                onClick={() => setDiaryRating(n === diaryRating ? 0 : n)}
                title={`${n}/10`}
                className={`text-lg leading-none transition-colors ${n <= diaryRating ? 'text-accent' : 'text-white/15 hover:text-accent/50'}`}
              >★</button>
            ))}
            <span className="text-sm text-muted ml-1.5 w-10">{diaryRating ? `${diaryRating}/10` : ''}</span>
          </div>
        </div>
        <textarea
          value={diaryText}
          onChange={(e) => setDiaryText(e.target.value)}
          maxLength={8000}
          rows={4}
          placeholder="Личные впечатления, мысли, цитаты… (видно только тебе)"
          className="w-full resize-y rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-text placeholder:text-muted/70 outline-none focus:border-accent/50"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted">{diaryText.length}/8000 · приватно</span>
          <button onClick={submitDiary} disabled={diarySaving} className="btn-primary !py-2 !px-5 text-sm">
            {diarySaving ? 'Сохраняю…' : diarySaved ? 'Сохранено ✓' : 'Сохранить'}
          </button>
        </div>
      </div>

      {relatedFull.length > 0 ? (
        <NativeRow title="Связанные релизы" items={relatedFull} />
      ) : release.related_releases && release.related_releases.length > 0 ? (
        <NativeRow title="Связанные релизы" items={release.related_releases} />
      ) : (
        <LinkedAnimeGrid title="Связанные релизы" items={relatedAnime} navigate={navigate} compact />
      )}

      {recommended.length > 0 ? (
        <NativeRow title="Рекомендации" items={recommended} />
      ) : (
        <LinkedAnimeGrid title="Похожее аниме" items={similarAnime} navigate={navigate} compact />
      )}
    </div>
  )
}
