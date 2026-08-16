import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFilter, extractReleases, genreList, type Release } from '../api/releases'
import { getDubbers, getSources, getEpisodes, type Episode } from '../api/episodes'
import { getContinueWatching, type ContinueItem } from '../api/progress'
import { img } from '../lib/img'
import '../styles/design-preview-v5.css'

// Прототип 5-го редизайна. Отдельная страница-витрина, живёт своей жизнью
// рядом с боевым дизайном: не переиспользует Layout/навбар/CSS остального
// сайта (см. App.tsx — подключена вне <Layout>, как и /player), не трогает
// сам плеер (см. секцию "watch" ниже — там просто макет обвязки, видео
// place­holder вместо реального плеера). Не коммитим, чисто для показа.

// Минималистичные однотонные иконки (stroke-based, вместо эмодзи).
function Star() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function IconMore() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}

function IconPlay({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconCircle() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function RatingBadge({ grade }: { grade?: number }) {
  if (!grade) return null
  return (
    <span className="dp5-rating">
      <Star /> {grade.toFixed(1)}
    </span>
  )
}

function PosterCard({ release, sub }: { release: Release; sub?: string }) {
  const genres = genreList(release.genres).slice(0, 2)
  return (
    <Link to={`/release/${release.id}`} className="dp5-card">
      <div className="dp5-card-poster">
        <img src={img(release.image)} alt="" loading="lazy" />
        <RatingBadge grade={release.grade} />
        <button className="dp5-bookmark" onClick={(e) => e.preventDefault()} aria-label="В список">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </div>
      <div className="dp5-card-body">
        <div className="dp5-card-title">{release.title_ru}</div>
        <div className="dp5-card-meta">
          {sub || (
            <>
              {release.year ? <span>{release.year}</span> : null}
              {genres.map((g) => <span key={g}>{g}</span>)}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function ContinueCard({ item }: { item: ContinueItem }) {
  const pct = item.duration > 0 ? Math.min(100, Math.round((item.position / item.duration) * 100)) : 0
  return (
    <div className="dp5-continue-card">
      <div className="dp5-continue-thumb">
        <div className="dp5-play-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
        <span className="dp5-pct">{pct}%</span>
        <div className="dp5-progress-track"><div className="dp5-progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="dp5-card-title">{item.title || 'Без названия'}</div>
      <div className="dp5-card-meta"><span>Серия {item.episode}</span></div>
    </div>
  )
}

export default function DesignPreviewV5() {
  const [hero, setHero] = useState<Release | null>(null)
  const [popular, setPopular] = useState<Release[]>([])
  const [ongoing, setOngoing] = useState<Release[]>([])
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([])
  const [detail, setDetail] = useState<Release | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [activeGenre, setActiveGenre] = useState('Все')
  const [activeTab, setActiveTab] = useState<'about' | 'episodes' | 'reviews'>('episodes')

  useEffect(() => {
    let cancelled = false
    getFilter(0, { sort: 1, extended_mode: true }).then((data) => {
      if (cancelled) return
      const list = extractReleases(data)
      setHero(list[0] || null)
      setPopular(list.slice(0, 6))
      setDetail(list[0] || null)
    }).catch(() => {})
    getFilter(0, { sort: 1, status_id: 2, extended_mode: true }).then((data) => {
      if (!cancelled) setOngoing(extractReleases(data).slice(0, 6))
    }).catch(() => {})
    getContinueWatching().then((items) => {
      if (!cancelled) setContinueItems(items.slice(0, 4))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!detail) return
    let cancelled = false
    getDubbers(detail.id).then((d) => {
      const type = d.types?.[0]
      if (!type) return
      return getSources(detail.id, type.id).then((s) => {
        const source = s.sources?.[0]
        if (!source) return
        return getEpisodes(detail.id, type.id, source.id).then((e) => {
          if (!cancelled) setEpisodes((e.episodes || []).slice(0, 5))
        })
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [detail])

  const genres = useMemo(() => {
    const set = new Set<string>()
    ;[...popular, ...ongoing].forEach((r) => genreList(r.genres).forEach((g) => set.add(g)))
    return ['Все', ...Array.from(set).slice(0, 9)]
  }, [popular, ongoing])

  const heroGenres = hero ? genreList(hero.genres).slice(0, 2) : []

  return (
    <div className="dp5-root">
      <div className="dp5-banner">
        Прототип #5 · не боевой дизайн · плеер не тронут (только обвязка вокруг него)
      </div>

      {/* ── Header ── */}
      <header className="dp5-header">
        <div className="dp5-logo">
          <span className="dp5-logo-mark">M</span>
          <span className="dp5-logo-text">MiraiHub</span>
        </div>
        <nav className="dp5-nav">
          <a className="active" href="#home">Главная</a>
          <a href="#catalog">Каталог</a>
          <a href="#ongoing">Онгоинги</a>
          <a href="#watch">Просмотр</a>
        </nav>
        <div className="dp5-header-right">
          <div className="dp5-search"><IconSearch /><input placeholder="Поиск аниме..." readOnly /><kbd>⌘K</kbd></div>
          <button className="dp5-icon-btn"><IconBell /><span className="dp5-badge">3</span></button>
          <div className="dp5-avatar" />
        </div>
      </header>

      <main className="dp5-main">
        {/* ── Hero ── */}
        <section className="dp5-layout" id="home">
          <div className="dp5-hero" style={{ backgroundImage: hero ? `url(${img(hero.image)})` : undefined }}>
            <div className="dp5-hero-fade" />
            <div className="dp5-hero-body">
              <span className="dp5-eyebrow">Премьера сезона</span>
              <h1>{hero?.title_ru || 'Загрузка…'}</h1>
              <p>{(hero?.description || '').slice(0, 160)}{hero?.description && hero.description.length > 160 ? '…' : ''}</p>
              <div className="dp5-hero-meta">
                <RatingBadge grade={hero?.grade} />
                {hero?.year && <span>{hero.year}</span>}
                {heroGenres.map((g) => <span key={g} className="dp5-pill-static">{g}</span>)}
              </div>
              <div className="dp5-hero-actions">
                {hero && <Link to={`/watch/${hero.id}`} className="dp5-btn-primary"><IconPlay /> Смотреть</Link>}
                <button className="dp5-btn-ghost">+ В список</button>
              </div>
            </div>
          </div>

          <aside className="dp5-sidebar">
            <div className="dp5-panel">
              <div className="dp5-panel-head"><h3>Расписание серий</h3><span className="dp5-link">Календарь</span></div>
              <p className="dp5-mock-note">пример вёрстки, без реальных данных</p>
              {['17:00 · Серия 8', '18:30 · Серия 9', '20:00 · Серия 10'].map((t) => (
                <div key={t} className="dp5-sched-row">
                  <div className="dp5-sched-thumb" />
                  <div>{t}</div>
                  <IconBell />
                </div>
              ))}
            </div>
            <div className="dp5-panel">
              <div className="dp5-panel-head"><h3>Новинки недели</h3><span className="dp5-link">Смотреть все</span></div>
              {popular.slice(0, 4).map((r) => (
                <Link to={`/release/${r.id}`} key={r.id} className="dp5-sched-row">
                  <img className="dp5-sched-thumb" src={img(r.image)} alt="" />
                  <div className="dp5-sched-text">{r.title_ru}</div>
                  <RatingBadge grade={r.grade} />
                </Link>
              ))}
            </div>
          </aside>
        </section>

        {continueItems.length > 0 && (
          <section className="dp5-row">
            <div className="dp5-row-head"><h2>Продолжить просмотр</h2><span className="dp5-link">Смотреть все</span></div>
            <div className="dp5-grid dp5-grid-continue">
              {continueItems.map((it, i) => <ContinueCard key={i} item={it} />)}
            </div>
          </section>
        )}

        <section className="dp5-row">
          <div className="dp5-row-head"><h2>Популярное сейчас</h2><span className="dp5-link">Смотреть все</span></div>
          <div className="dp5-grid dp5-grid-6">
            {popular.map((r) => <PosterCard key={r.id} release={r} />)}
          </div>
        </section>

        <section className="dp5-row" id="ongoing">
          <div className="dp5-row-head"><h2>Онгоинги</h2><span className="dp5-link">Смотреть все</span></div>
          <div className="dp5-grid dp5-grid-6">
            {ongoing.map((r) => <PosterCard key={r.id} release={r} sub="Новая серия" />)}
          </div>
        </section>

        <div className="dp5-genres">
          {genres.map((g) => (
            <button key={g} className={g === activeGenre ? 'active' : ''} onClick={() => setActiveGenre(g)}>{g}</button>
          ))}
        </div>

        {/* ── Catalog ── */}
        <section className="dp5-section" id="catalog">
          <h2 className="dp5-section-title">Каталог</h2>
          <div className="dp5-catalog">
            <aside className="dp5-filters">
              <div className="dp5-panel-head"><h3>Фильтры</h3><span className="dp5-link">Сбросить</span></div>
              <div className="dp5-filter-group">
                <div className="dp5-filter-label">Жанры</div>
                {genres.slice(1, 6).map((g) => (
                  <label key={g} className="dp5-check-row"><input type="checkbox" readOnly /> {g}</label>
                ))}
              </div>
              <div className="dp5-filter-group">
                <div className="dp5-filter-label">Статус</div>
                {['Вышел', 'Онгоинг', 'Анонс'].map((s) => (
                  <label key={s} className="dp5-check-row"><input type="checkbox" readOnly /> {s}</label>
                ))}
              </div>
            </aside>
            <div className="dp5-grid dp5-grid-4">
              {[...popular, ...ongoing].slice(0, 8).map((r) => <PosterCard key={r.id} release={r} />)}
            </div>
          </div>
        </section>

        {/* ── Release detail ── */}
        {detail && (
          <section className="dp5-section">
            <h2 className="dp5-section-title">Страница тайтла</h2>
            <div className="dp5-detail">
              <div
                className="dp5-detail-hero"
                style={{ backgroundImage: `url(${img(detail.image)})` }}
              >
                <div className="dp5-hero-fade" />
                <div className="dp5-detail-hero-body">
                  <h2>{detail.title_ru}</h2>
                  <div className="dp5-hero-meta">
                    <RatingBadge grade={detail.grade} />
                    {detail.year && <span>{detail.year}</span>}
                  </div>
                  <Link to={`/release/${detail.id}`} className="dp5-btn-primary"><IconPlay /> Смотреть</Link>
                </div>
              </div>
              <div className="dp5-detail-body">
                <div className="dp5-tabs">
                  {(['about', 'episodes', 'reviews'] as const).map((t) => (
                    <button key={t} className={t === activeTab ? 'active' : ''} onClick={() => setActiveTab(t)}>
                      {t === 'about' ? 'О сериале' : t === 'episodes' ? 'Серии' : 'Отзывы'}
                    </button>
                  ))}
                </div>
                {activeTab === 'about' && <p className="dp5-description">{detail.description || 'Описание отсутствует.'}</p>}
                {activeTab === 'episodes' && (
                  <div className="dp5-episode-list">
                    {episodes.length === 0 && <p className="dp5-mock-note">Загрузка серий…</p>}
                    {episodes.map((ep) => (
                      <div key={ep.position} className="dp5-episode-row">
                        <span className="dp5-ep-num">{ep.position}</span>
                        <div className="dp5-ep-text">{ep.name || `Серия ${ep.position}`}</div>
                        {ep.is_watched ? <span className="dp5-check"><IconCheck /></span> : <span className="dp5-lock"><IconCircle /></span>}
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'reviews' && <p className="dp5-mock-note">пример вёрстки, без реальных данных</p>}
              </div>
            </div>
          </section>
        )}

        {/* ── Watch / player chrome (плеер не трогаем — это просто макет обвязки) ── */}
        <section className="dp5-section" id="watch">
          <h2 className="dp5-section-title">Просмотр — плеер встроен как на YouTube, а не на весь экран</h2>
          <p className="dp5-mock-note" style={{ marginBottom: 12 }}>
            Ниже — только вёрстка вокруг плеера. Сам плеер (видео, контролы, качество, озвучка) остаётся текущим,
            без изменений — просто перестаёт разворачиваться на весь экран.
          </p>
          <div className="dp5-watch">
            <div className="dp5-watch-video">
              {detail && <img src={img(detail.image)} alt="" />}
              <div className="dp5-video-fade" />
              <button className="dp5-play-big">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>
              <div className="dp5-video-controls-mock">
                <div className="dp5-progress-track"><div className="dp5-progress-fill" style={{ width: '38%' }} /></div>
                <span>текущий плеер — без изменений</span>
              </div>
            </div>
            <aside className="dp5-watch-side">
              <div className="dp5-panel-head"><h3>Список серий</h3></div>
              {episodes.map((ep, i) => (
                <div key={ep.position} className={`dp5-sched-row ${i === 0 ? 'dp5-current' : ''}`}>
                  <span className="dp5-ep-num">{ep.position}</span>
                  <div className="dp5-sched-text">{ep.name || `Серия ${ep.position}`}</div>
                  {i === 0 ? <span className="dp5-now">Сейчас</span> : ep.is_watched ? <span className="dp5-check"><IconCheck /></span> : null}
                </div>
              ))}
            </aside>
          </div>
        </section>

        {/* ── Mobile mockups ── */}
        <section className="dp5-section">
          <h2 className="dp5-section-title">Мобильная версия</h2>
          <div className="dp5-phones">
            {(['Главная', 'Каталог', 'Тайтл', 'Плеер'] as const).map((label) => (
              <div className="dp5-phone" key={label}>
                <div className="dp5-phone-notch" />
                <div className="dp5-phone-screen">
                  <div className="dp5-phone-bar">
                    <span>M</span>
                    <span>{label}</span>
                    <IconMore />
                  </div>
                  {label === 'Плеер' && detail ? (
                    <>
                      <img className="dp5-phone-hero" src={img(detail.image)} alt="" />
                      <div className="dp5-phone-video-controls">
                        <div className="dp5-progress-track"><div className="dp5-progress-fill" style={{ width: '54%' }} /></div>
                      </div>
                      <div className="dp5-phone-list">
                        {episodes.slice(0, 3).map((ep) => (
                          <div key={ep.position} className="dp5-phone-row">{ep.position}. {ep.name || `Серия ${ep.position}`}</div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {hero && <img className="dp5-phone-hero" src={img(hero.image)} alt="" />}
                      <div className="dp5-phone-grid">
                        {popular.slice(0, 4).map((r) => (
                          <div key={r.id} className="dp5-phone-card">
                            <img src={img(r.image)} alt="" />
                            <div>{r.title_ru}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="dp5-footer">
        <div className="dp5-logo"><span className="dp5-logo-mark">M</span><span className="dp5-logo-text">MiraiHub</span></div>
        <p>Прототип дизайна — /design-preview-v5, отдельно от боевой сборки.</p>
      </footer>
    </div>
  )
}
