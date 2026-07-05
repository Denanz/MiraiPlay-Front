import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth'
import { listScreenshots, deleteScreenshot, saveScreenshotNote, shotFileUrl, type ShotMeta } from '../api/screenshots'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import { syncWidget } from '../lib/widgetSync'
import '../styles/modern-gallery.css'

const ALL_KEY = '__all__'
const UNKNOWN_KEY = '__unknown__'

interface Folder {
  key: string
  title: string
  items: ShotMeta[]
  latest: number
}

function fmtTime(s?: number): string {
  if (!s) return ''
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function GalleryPage() {
  const { session } = useAuth()
  const design = useDesign()
  const [items, setItems] = useState<ShotMeta[] | null>(null)
  const [bucket, setBucket] = useState('')
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<ShotMeta | null>(null)
  // Note editor: the screenshot being annotated + the draft text + saving flag.
  const [noteFor, setNoteFor] = useState<ShotMeta | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  // Folder browsing: null = overview grid of titles, ALL_KEY = flat view of everything.
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [folderQuery, setFolderQuery] = useState('')
  // Filters within a folder — reset whenever a different folder is opened.
  const [epFilter, setEpFilter] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const openFolder = (key: string | null) => {
    setActiveFolder(key)
    setEpFilter('')
    setDateFrom('')
    setDateTo('')
  }

  useEffect(() => {
    if (!session) return
    listScreenshots()
      .then(({ bucket, items }) => { setBucket(bucket); setItems(items) })
      .catch(() => setError('Не удалось загрузить галерею'))
  }, [session])

  // Push a pool of recent shots to the "Свежий скриншот" widget — it picks a
  // random one from these each time it refreshes (native side, see
  // ScreenshotWidgetProvider), so the tile rotates on its own over time.
  useEffect(() => {
    if (!items || items.length === 0) return
    const pool = [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12)
    const images: Record<string, string> = {}
    for (const s of pool) images[`screenshot_${s.id}`] = shotFileUrl(bucket, s.id)
    syncWidget('screenshot', {
      items: pool.map((s) => ({
        id: s.id,
        releaseId: s.releaseId || '',
        title: s.title || 'Кадр',
        sub: [s.episode ? `эп. ${s.episode}` : '', fmtTime(s.time)].filter(Boolean).join(' · '),
      })),
    }, images)
  }, [items, bucket])

  // Group by release (falls back to title text, then an "untitled" bucket) —
  // releaseId is the stable key since two different releases could in theory
  // share the same title text (remakes/rebroadcasts).
  const folders = useMemo<Folder[]>(() => {
    if (!items) return []
    const map = new Map<string, Folder>()
    for (const s of items) {
      const key = s.releaseId || s.title || UNKNOWN_KEY
      const existing = map.get(key)
      if (existing) {
        existing.items.push(s)
        if (s.createdAt > existing.latest) existing.latest = s.createdAt
      } else {
        map.set(key, { key, title: s.title || 'Без названия', items: [s], latest: s.createdAt })
      }
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest)
  }, [items])

  const visibleFolders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter(f => f.title.toLowerCase().includes(q))
  }, [folders, folderQuery])

  const activeFolderObj = activeFolder && activeFolder !== ALL_KEY
    ? folders.find(f => f.key === activeFolder) || null
    : null
  const visibleItems = activeFolder === ALL_KEY ? items : activeFolderObj?.items ?? null

  const episodesInView = useMemo(() => {
    if (!visibleItems) return []
    const set = new Set<number>()
    for (const s of visibleItems) if (s.episode) set.add(s.episode)
    return [...set].sort((a, b) => a - b)
  }, [visibleItems])

  const filteredItems = useMemo(() => {
    if (!visibleItems) return null
    let list = visibleItems
    if (epFilter !== '') list = list.filter(s => s.episode === epFilter)
    if (dateFrom) {
      const fromMs = new Date(`${dateFrom}T00:00:00`).getTime()
      list = list.filter(s => s.createdAt >= fromMs)
    }
    if (dateTo) {
      const toMs = new Date(`${dateTo}T23:59:59.999`).getTime()
      list = list.filter(s => s.createdAt <= toMs)
    }
    return list
  }, [visibleItems, epFilter, dateFrom, dateTo])

  const folderFiltersActive = epFilter !== '' || !!dateFrom || !!dateTo
  const chipClass = (active: boolean) => design === 'modern'
    ? `mdk-chip ${active ? 'mdk-chip-acc' : ''}`
    : `chip ${active ? 'chip-active' : ''}`

  if (!session) return null

  const remove = async (s: ShotMeta) => {
    if (!confirm('Удалить этот скриншот с сервера?')) return
    try {
      await deleteScreenshot(s.id)
      setItems(prev => prev?.filter(x => x.id !== s.id) ?? null)
      if (lightbox?.id === s.id) setLightbox(null)
    } catch { /* ignore */ }
  }

  const openNote = (s: ShotMeta) => {
    setNoteFor(s)
    setNoteDraft(s.note || '')
  }

  const saveNote = async () => {
    if (!noteFor) return
    const text = noteDraft.trim()
    setNoteSaving(true)
    try {
      await saveScreenshotNote(noteFor.id, text)
      const apply = (x: ShotMeta) => (x.id === noteFor.id ? { ...x, note: text || undefined } : x)
      setItems(prev => prev?.map(apply) ?? null)
      setLightbox(prev => (prev && prev.id === noteFor.id ? apply(prev) : prev))
      setNoteFor(null)
    } catch { /* ignore */ } finally {
      setNoteSaving(false)
    }
  }

  const download = async (s: ShotMeta) => {
    try {
      const res = await fetch(shotFileUrl(bucket, s.id))
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const name = [s.title?.replace(/[^\wа-яё .-]/gi, '').slice(0, 60) || 'screenshot', s.episode ? `эп${s.episode}` : '']
        .filter(Boolean).join(' ')
      a.download = `${name}.${s.ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch { /* ignore */ }
  }

  if (error) return <div className="text-center text-muted py-20 text-sm">{error}</div>
  if (!items) return <Spinner variant="grid" />

  const empty = (
    <div className="text-center text-muted py-20 text-sm">
      Пока пусто. Делай кадры в плеере кнопкой 📷 (или клавишей S) — они появятся здесь.
    </div>
  )

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {episodesInView.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button className={chipClass(epFilter === '')} onClick={() => setEpFilter('')}>Все серии</button>
          {episodesInView.map(ep => (
            <button key={ep} className={chipClass(epFilter === ep)} onClick={() => setEpFilter(ep)}>Эп. {ep}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
               className="input !py-1.5 !px-2.5 !w-auto text-sm" />
        <span className="text-muted text-sm">—</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
               className="input !py-1.5 !px-2.5 !w-auto text-sm" />
      </div>
      {folderFiltersActive && (
        <button
          onClick={() => { setEpFilter(''); setDateFrom(''); setDateTo('') }}
          className={design === 'modern' ? 'mdk-btn mdk-btn-ghost' : 'text-sm text-accent-soft hover:underline'}
        >
          Сбросить
        </button>
      )}
    </div>
  )

  const noFilterMatches = (
    <div className="text-center text-muted py-16 text-sm">Ничего не найдено по фильтру</div>
  )

  return (
    <div>
      {design === 'modern' ? (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-[34px]">Галерея <span className="mdk-chip mdk-chip-acc align-middle">{items.length}</span></h1>
              <div className="text-[#9b92ad] text-sm mt-1">
                {visibleItems ? (activeFolderObj?.title || 'Все скриншоты') : 'кадры из плеера · с заметками'}
              </div>
            </div>
            {visibleItems && (
              <button onClick={() => openFolder(null)} className="mdk-btn mdk-btn-ghost">← Все тайтлы</button>
            )}
          </div>

          {items.length === 0 ? empty : !visibleItems ? (
            <>
              {folders.length > 1 && (
                <input
                  value={folderQuery}
                  onChange={e => setFolderQuery(e.target.value)}
                  placeholder="Поиск по названию…"
                  className="input w-full max-w-sm mb-5"
                />
              )}
              <div className="mdp-gallery-folders">
                <button className="mdp-gallery-folder" onClick={() => openFolder(ALL_KEY)}>
                  <div className="mdp-gallery-folder-cover" style={{ backgroundImage: `url(${shotFileUrl(bucket, items[0].id)})` }} />
                  <div className="mdp-gallery-folder-cap">
                    <div className="t">Все скриншоты</div>
                    <div className="s">{items.length}</div>
                  </div>
                </button>
                {visibleFolders.map(f => (
                  <button key={f.key} className="mdp-gallery-folder" onClick={() => openFolder(f.key)}>
                    <div className="mdp-gallery-folder-cover" style={{ backgroundImage: `url(${shotFileUrl(bucket, f.items[0].id)})` }} />
                    <div className="mdp-gallery-folder-cap">
                      <div className="t">{f.title}</div>
                      <div className="s">{f.items.length}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {filterBar}
              {filteredItems!.length === 0 ? noFilterMatches : (
                <div className="mdp-gallery-masonry">
                  {filteredItems!.map(s => (
                    <div key={s.id} className="mdp-gallery-shot">
                      <button onClick={() => setLightbox(s)} className="block w-full">
                        <img src={shotFileUrl(bucket, s.id)} alt={s.title || ''} loading="lazy" />
                      </button>
                      <div className="mdp-gallery-tools">
                        <button onClick={() => openNote(s)} title={s.note ? 'Изм. заметку' : 'Заметка'}>📝</button>
                        <button onClick={() => download(s)} title="Скачать">⬇</button>
                        <button onClick={() => remove(s)} className="danger" title="Удалить">🗑</button>
                      </div>
                      <div className="mdp-gallery-cap">
                        <div className="t">{s.title || 'Кадр'}</div>
                        <div className="s">{[s.episode ? `эп. ${s.episode}` : '', fmtTime(s.time)].filter(Boolean).join(' · ')}</div>
                        {s.note && <div className="mdp-gallery-note">{s.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <h1 className="text-xl font-bold">Галерея</h1>
            <span className="chip chip-active">{items.length}</span>
            {visibleItems && (
              <>
                <span className="text-muted">/</span>
                <span className="text-sm text-muted">{activeFolderObj?.title || 'Все скриншоты'}</span>
                <button onClick={() => openFolder(null)} className="text-sm text-accent-soft hover:underline ml-auto">
                  ← Все тайтлы
                </button>
              </>
            )}
          </div>

          {items.length === 0 ? empty : !visibleItems ? (
            <>
              {folders.length > 1 && (
                <input
                  value={folderQuery}
                  onChange={e => setFolderQuery(e.target.value)}
                  placeholder="Поиск по названию…"
                  className="input w-full max-w-sm mb-5"
                />
              )}
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                <button onClick={() => openFolder(ALL_KEY)} className="panel overflow-hidden group text-left">
                  <div className="w-full aspect-video bg-black/40 bg-cover bg-center"
                       style={{ backgroundImage: `url(${shotFileUrl(bucket, items[0].id)})` }} />
                  <div className="p-3">
                    <div className="text-sm font-medium truncate">Все скриншоты</div>
                    <div className="text-xs text-muted mt-0.5">{items.length}</div>
                  </div>
                </button>
                {visibleFolders.map(f => (
                  <button key={f.key} onClick={() => openFolder(f.key)} className="panel overflow-hidden group text-left">
                    <div className="w-full aspect-video bg-black/40 bg-cover bg-center"
                         style={{ backgroundImage: `url(${shotFileUrl(bucket, f.items[0].id)})` }} />
                    <div className="p-3">
                      <div className="text-sm font-medium truncate">{f.title}</div>
                      <div className="text-xs text-muted mt-0.5">{f.items.length}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {filterBar}
              {filteredItems!.length === 0 ? noFilterMatches : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredItems!.map(s => (
                    <div key={s.id} className="panel overflow-hidden group">
                      <button onClick={() => setLightbox(s)} className="block w-full aspect-video bg-black/40">
                        <img src={shotFileUrl(bucket, s.id)} alt={s.title || ''} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                      <div className="p-2">
                        <div className="text-xs truncate">{s.title || 'Кадр'}</div>
                        <div className="text-[10px] text-muted">
                          {[s.episode ? `эп. ${s.episode}` : '', fmtTime(s.time)].filter(Boolean).join(' · ')}
                        </div>
                        {s.note && (
                          <div className="mt-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-1 text-[11px] text-text/80 whitespace-pre-wrap break-words line-clamp-4">
                            {s.note}
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-1.5">
                          <button onClick={() => openNote(s)} className="btn-ghost !py-1 !px-2 text-xs flex-1">
                            📝 {s.note ? 'Изм. заметку' : 'Заметка'}
                          </button>
                          <button onClick={() => download(s)} className="btn-ghost !py-1 !px-2 text-xs">⬇</button>
                          <button onClick={() => remove(s)} className="btn-ghost !py-1 !px-2 text-xs text-red-400">🗑</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img src={shotFileUrl(bucket, lightbox.id)} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />
            {lightbox.note && (
              <div className="mt-3 mx-auto max-w-2xl rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-sm text-text/85 whitespace-pre-wrap break-words">
                {lightbox.note}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3 justify-center">
              <span className="text-sm text-muted">{lightbox.title} {lightbox.episode ? `· эп. ${lightbox.episode}` : ''}</span>
              <button onClick={() => openNote(lightbox)} className="btn-ghost !py-1 !px-3 text-sm">📝 {lightbox.note ? 'Изм. заметку' : 'Заметка'}</button>
              <button onClick={() => download(lightbox)} className="btn-ghost !py-1 !px-3 text-sm">⬇ Скачать</button>
              <button onClick={() => remove(lightbox)} className="btn-ghost !py-1 !px-3 text-sm text-red-400">🗑 Удалить</button>
              <button onClick={() => setLightbox(null)} className="btn-ghost !py-1 !px-3 text-sm">✕</button>
            </div>
          </div>
        </div>
      )}

      {noteFor && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => !noteSaving && setNoteFor(null)}>
          <div className="panel w-full max-w-lg p-4 sm:p-5" style={{ backgroundColor: '#100c1a' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold">Заметка к кадру</h2>
              <span className="text-xs text-muted truncate">
                {[noteFor.title || 'Кадр', noteFor.episode ? `эп. ${noteFor.episode}` : '', fmtTime(noteFor.time)].filter(Boolean).join(' · ')}
              </span>
            </div>
            <textarea
              autoFocus
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Например: красивый кадр, цитата, момент для обоев…"
              className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
            <div className="flex items-center justify-between gap-2 mt-3">
              <span className="text-[11px] text-muted">{noteDraft.length}/2000</span>
              <div className="flex gap-2">
                <button onClick={() => setNoteFor(null)} disabled={noteSaving} className="btn-ghost !py-1.5 !px-3 text-sm">Отмена</button>
                <button onClick={saveNote} disabled={noteSaving} className="btn-primary !py-1.5 !px-4 text-sm">
                  {noteSaving ? 'Сохраняю…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
