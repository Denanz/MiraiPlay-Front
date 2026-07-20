import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { getProfile, type AnixartProfile } from '../api/profile'
import { useAuth } from '../store/auth'
import { useDesign } from '../lib/design'
import Spinner from '../components/Spinner'
import ShikimoriDigest from '../components/ShikimoriDigest'
import { syncWidget } from '../lib/widgetSync'
import '../styles/modern-stats.css'

// Anixart reports watched_time in MINUTES (~23.5/episode).
function formatWatchTime(minutes?: number): string {
  if (!minutes || minutes <= 0) return '0 ч'
  const days = Math.floor(minutes / (60 * 24))
  const hours = Math.floor((minutes % (60 * 24)) / 60)
  const mins = Math.floor(minutes % 60)
  const parts: string[] = []
  if (days) parts.push(`${days} д`)
  if (hours) parts.push(`${hours} ч`)
  if (mins && !days) parts.push(`${mins} мин`)
  return parts.join(' ') || '0 ч'
}

function formatDate(ts?: number): string {
  if (!ts || ts <= 0) return '—'
  return new Date(ts * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Current streak: consecutive most-recent days (by timestamp) with activity.
function computeStreak(points: { count: number; timestamp: number }[]): number {
  const sorted = [...points].sort((a, b) => b.timestamp - a.timestamp)
  let streak = 0
  for (const p of sorted) {
    if (p.count > 0) streak++
    else break
  }
  return streak
}

function heatColor(count: number, max: number): string {
  if (count <= 0) return 'rgba(255,255,255,0.05)'
  const t = Math.min(1, count / Math.max(1, max))
  // violet ramp
  const a = 0.25 + t * 0.65
  return `rgb(var(--accent-rgb) / ${a.toFixed(2)})`
}

export default function StatsPage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const design = useDesign()
  const [profile, setProfile] = useState<AnixartProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    setLoading(true)
    getProfile(session.userId)
      .then((p) => { if (p) setProfile(p); else setError('Профиль не найден') })
      .catch(() => setError('Не удалось загрузить профиль'))
      .finally(() => setLoading(false))
  }, [session])

  // Push streak + headline episode count to the "Стрик" home-screen widget.
  useEffect(() => {
    if (!profile) return
    syncWidget('stats', {
      streak: computeStreak(profile.watch_dynamics || []),
      episodes: profile.watched_episode_count ?? 0,
    })
  }, [profile])

  if (loading) return <Spinner variant="grid" />
  if (error || !profile) {
    return <div className="text-center text-muted py-20 text-sm">{error || 'Нет данных'}</div>
  }

  const lists: Array<{ label: string; value?: number; accent?: boolean }> = [
    { label: 'Смотрю', value: profile.watching_count },
    { label: 'В планах', value: profile.plan_count },
    { label: 'Просмотрено', value: profile.completed_count },
    { label: 'Отложено', value: profile.hold_on_count },
    { label: 'Брошено', value: profile.dropped_count },
    { label: 'Избранное', value: profile.favorite_count },
  ]

  const headline: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Серий просмотрено', value: String(profile.watched_episode_count ?? 0) },
    { label: 'Время за просмотром', value: formatWatchTime(profile.watched_time) },
    { label: 'Оценок поставлено', value: String(profile.rating_score ?? 0) },
  ]

  const extra: Array<{ label: string; value?: number }> = [
    { label: 'Комментарии', value: profile.comment_count },
    { label: 'Коллекции', value: profile.collection_count },
    { label: 'Видео', value: profile.video_count },
    { label: 'Друзья', value: profile.friend_count },
  ]

  const dynamics = profile.watch_dynamics || []
  const maxCount = dynamics.reduce((m, p) => Math.max(m, p.count), 0)
  const streak = computeStreak(dynamics)
  const genres = profile.preferred_genres || []
  const initials = profile.login ? profile.login.slice(0, 2).toUpperCase() : '??'

  if (design === 'modern') {
    return (
      <div>
        <div className="mdp-stats-prof">
          <div className="mdp-stats-av">
            {profile.avatar ? <img src={profile.avatar} alt="" /> : initials}
          </div>
          <div>
            <h1 className="mdp-stats-name">
              {profile.login}
              {profile.sponsor_labels && profile.sponsor_labels.length > 0
                ? profile.sponsor_labels.map((l) => (
                    <span key={l} className="mdk-chip mdk-chip-acc" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{l}</span>
                  ))
                : profile.is_sponsor && <span className="mdk-chip mdk-chip-acc" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Спонсор</span>}
            </h1>
            <div className="mdp-stats-sub">
              на MiraiHub с {formatDate(profile.register_date)} · последняя активность {formatDate(profile.last_activity_time)}
            </div>
          </div>
        </div>

        <ShikimoriDigest />

        <div className="flex flex-wrap gap-2 mb-6">
          <Link to="/achievements" className="mdk-btn mdk-btn-ghost">🏆 Ачивки</Link>
          <Link to="/gallery" className="mdk-btn mdk-btn-ghost">📸 Галерея</Link>
          {!Capacitor.isNativePlatform() && (
            <a href="https://anime.denanz.fun/mirai.apk" download className="mdk-btn mdk-btn-ghost">📱 Скачать APK</a>
          )}
          <button onClick={() => { logout(); navigate('/login') }} className="mdk-btn mdk-btn-ghost text-red-400" style={{ marginLeft: 'auto' }}>
            Выйти
          </button>
        </div>

        <div className="mdk-bento mdp-stats-bento">
          {headline.map((m) => (
            <div key={m.label} className="mdp-stats-b mdk-glass mdk-metric">
              <div className="mdk-n" style={{ color: 'rgb(var(--accent-soft-rgb))' }}>{m.value}</div>
              <div className="mdk-l">{m.label}</div>
            </div>
          ))}
          <div className="mdp-stats-b mdk-glass mdk-metric">
            <div className="mdk-n" style={{ color: 'rgb(var(--accent-soft-rgb))' }}>{streak} 🔥</div>
            <div className="mdk-l">Дней подряд</div>
          </div>

          {genres.length > 0 && (
            <div className="mdp-stats-b wide tall mdk-glass">
              <h3 style={{ marginBottom: 14 }}>Любимые жанры</h3>
              {genres.map((g) => (
                <div key={g.name} className="mdp-stats-barrow">
                  <span className="label truncate capitalize">{g.name}</span>
                  <span className="track"><i style={{ width: `${Math.min(100, g.percentage)}%` }} /></span>
                  <b>{g.percentage}</b>
                </div>
              ))}
            </div>
          )}

          <div className="mdp-stats-b wide mdk-glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ marginBottom: 6 }}>Год в просмотре · Wrapped</h3>
            <p style={{ color: '#9b92ad', fontSize: 13 }}>Твоя персональная ретроспектива готова →</p>
            <Link to="/wrapped" className="mdk-btn mdk-btn-primary" style={{ marginTop: 12, alignSelf: 'flex-start' }}>Открыть Wrapped</Link>
          </div>

          {dynamics.length > 0 && (
            <div className="mdp-stats-b wide mdk-glass">
              <h3 style={{ marginBottom: 12 }}>Активность</h3>
              <div className="mdp-stats-heat">
                {[...dynamics].sort((a, b) => a.timestamp - b.timestamp).map((p) => (
                  <b key={p.id} title={`${new Date(p.timestamp * 1000).toLocaleDateString('ru-RU')}: ${p.count} серий`} style={{ background: heatColor(p.count, maxCount) }} />
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#9b92ad', marginTop: 8 }}>Последние {dynamics.length} дней</p>
            </div>
          )}

          <div className="mdp-stats-b wide mdk-glass">
            <h3 style={{ marginBottom: 12 }}>Списки</h3>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <button key={l.label} onClick={() => navigate(`/bookmarks?tab=${encodeURIComponent(l.label)}`)} className="mdk-chip mdk-chip-acc" style={{ cursor: 'pointer' }}>
                  {l.label} · {l.value ?? 0}
                </button>
              ))}
            </div>
          </div>

          {extra.some((e) => (e.value ?? 0) > 0) && (
            <div className="mdp-stats-b wide mdk-glass">
              <h3 style={{ marginBottom: 12 }}>Активность на сайте</h3>
              <div className="flex flex-wrap gap-4">
                {extra.map((e) => (
                  <div key={e.label}>
                    <div className="mdk-n" style={{ fontSize: 20 }}>{e.value ?? 0}</div>
                    <div className="mdk-l">{e.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link to="/settings" className="mdk-glass mdk-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontWeight: 500 }}>⚙ Настройки</span>
          <span style={{ color: '#9b92ad', fontSize: 13 }}>Тема · Уведомления · Импорт/экспорт →</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-bold">Статистика</h1>
        <Link to="/wrapped" className="btn-primary !py-2 shrink-0">✨ Год в просмотре</Link>
      </div>
      <p className="text-sm text-muted mb-5">
        {profile.login}
        {profile.sponsor_labels && profile.sponsor_labels.length > 0
          ? profile.sponsor_labels.map((l) => (
              <span key={l} className="ml-2 chip chip-active !py-0.5">{l}</span>
            ))
          : profile.is_sponsor && <span className="ml-2 chip chip-active !py-0.5">Спонсор</span>}
      </p>

      {/* Quick links (esp. for mobile bottom-nav users) + logout */}
      <div className="flex flex-wrap gap-2 mb-7">
        <Link to="/achievements" className="btn-ghost !py-2">🏆 Ачивки</Link>
        <Link to="/gallery" className="btn-ghost !py-2">📸 Галерея</Link>
        {!Capacitor.isNativePlatform() && (
          <a href="https://anime.denanz.fun/mirai.apk" download className="btn-ghost !py-2">📱 Скачать APK</a>
        )}
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="btn-ghost !py-2 text-red-400 ml-auto"
        >
          Выйти
        </button>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {headline.map((m) => (
          <div key={m.label} className="panel p-5">
            <div className="text-2xl sm:text-3xl font-bold text-accent-soft">{m.value}</div>
            <div className="text-sm text-muted mt-1">{m.label}</div>
          </div>
        ))}
        <div className="panel p-5">
          <div className="text-2xl sm:text-3xl font-bold text-accent-soft">{streak} 🔥</div>
          <div className="text-sm text-muted mt-1">Дней подряд</div>
        </div>
      </div>

      {/* Отдельным блоком на всю ширину: внутри сетки метрик он становился её
          ячейкой и схлопывался в одну узкую колонку. */}
      <ShikimoriDigest />

      {/* Activity heatmap */}
      {dynamics.length > 0 && (
        <div className="panel p-5 mb-8">
          <h2 className="text-base font-semibold mb-4">Активность</h2>
          <div className="flex flex-wrap gap-1">
            {[...dynamics].sort((a, b) => a.timestamp - b.timestamp).map((p) => (
              <div
                key={p.id}
                title={`${new Date(p.timestamp * 1000).toLocaleDateString('ru-RU')}: ${p.count} серий`}
                className="w-4 h-4 rounded-sm"
                style={{ background: heatColor(p.count, maxCount) }}
              />
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Последние {dynamics.length} дней · ярче = больше просмотров</p>
        </div>
      )}

      {/* Genre taste profile */}
      {genres.length > 0 && (
        <div className="panel p-5 mb-8">
          <h2 className="text-base font-semibold mb-4">Любимые жанры</h2>
          <div className="space-y-2.5">
            {genres.map((g) => (
              <div key={g.name} className="flex items-center gap-3">
                <span className="text-sm text-text/85 w-32 shrink-0 capitalize truncate">{g.name}</span>
                <div className="flex-1 h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, g.percentage)}%` }} />
                </div>
                <span className="text-xs text-muted w-9 text-right">{g.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lists breakdown */}
      <h2 className="text-base font-semibold mb-3">Списки</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {lists.map((l) => (
          <button
            key={l.label}
            onClick={() => navigate(`/bookmarks?tab=${encodeURIComponent(l.label)}`)}
            className="panel p-4 text-left hover:border-accent/30 transition-colors"
          >
            <div className="text-2xl font-semibold">{l.value ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">{l.label}</div>
          </button>
        ))}
      </div>

      {/* Extra + meta */}
      <h2 className="text-base font-semibold mb-3">Активность</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {extra.map((e) => (
          <div key={e.label} className="panel p-4">
            <div className="text-2xl font-semibold">{e.value ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">{e.label}</div>
          </div>
        ))}
      </div>

      <div className="panel p-5 text-sm space-y-2">
        <div className="flex justify-between border-b border-white/[0.05] pb-2">
          <span className="text-muted">Регистрация</span>
          <span className="text-text/90">{formatDate(profile.register_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Последняя активность</span>
          <span className="text-text/90">{formatDate(profile.last_activity_time)}</span>
        </div>
      </div>

      <Link to="/settings" className="panel p-5 flex items-center justify-between hover:border-accent/40 transition-colors">
        <span className="flex items-center gap-2 font-medium">⚙ Настройки</span>
        <span className="text-muted text-sm">Тема · Уведомления · Импорт/экспорт →</span>
      </Link>
    </div>
  )
}
