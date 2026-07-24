import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { computeWrapped, type WrappedStats } from '../lib/wrapped'
import { getProfile, type AnixartProfile } from '../api/profile'
import { useAuth } from '../store/auth'
import Spinner from '../components/Spinner'
import { img } from '../lib/img'
import { shareWrappedCard } from '../lib/wrappedImage'

function hoursFromMinutes(min?: number): string {
  if (!min || min <= 0) return '0'
  return Math.round(min / 60).toLocaleString('ru-RU')
}

function TallyBars({ title, items }: { title: string; items: { name: string; count: number }[] }) {
  if (items.length === 0) return null
  const max = items[0].count
  return (
    <div className="panel p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      <div className="space-y-2.5">
        {items.map((t) => (
          <div key={t.name} className="flex items-center gap-3">
            <span className="text-sm text-text/85 w-32 shrink-0 capitalize truncate">{t.name}</span>
            <div className="flex-1 h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(6, (t.count / max) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted w-8 text-right">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WrappedPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<WrappedStats | null>(null)
  const [profile, setProfile] = useState<AnixartProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([computeWrapped(), getProfile(session.userId)])
      .then(([s, p]) => { setStats(s); setProfile(p) })
      .catch(() => setError('Не удалось собрать сводку'))
      .finally(() => setLoading(false))
  }, [session])

  if (loading) {
    return (
      <div className="text-center py-24">
        <Spinner variant="grid" />
        <p className="text-sm text-muted mt-4">Собираю твою историю за всё время…</p>
      </div>
    )
  }
  if (error || !stats) {
    return <div className="text-center text-muted py-20 text-sm">{error || 'Нет данных'}</div>
  }

  const headline = [
    { v: (profile?.watched_episode_count ?? 0).toLocaleString('ru-RU'), l: 'серий просмотрено' },
    { v: hoursFromMinutes(profile?.watched_time), l: 'часов за просмотром' },
    { v: stats.totalReleases.toLocaleString('ru-RU'), l: 'тайтлов в истории' },
    { v: String(stats.genres[0]?.name ?? '—'), l: 'любимый жанр' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost">← Назад</button>
        <button
          onClick={() => shareWrappedCard({
            login: profile?.login ?? '',
            episodes: headline[0].v,
            hours: headline[1].v,
            titles: headline[2].v,
            genre: headline[3].v,
            binge: stats.longestBinge
              ? {
                  title: stats.longestBinge.title_ru ?? '',
                  episode: stats.longestBinge.last_view_episode?.position,
                }
              : null,
          })}
          className="btn-primary ml-auto !py-2 text-sm"
        >
          Сохранить картинкой
        </button>
      </div>

      <div className="text-center mb-10">
        <div className="text-5xl mb-3">✨</div>
        <h1 className="text-3xl font-bold">Год в просмотре</h1>
        <p className="text-muted mt-2">Вся твоя история на {profile?.login}</p>
      </div>

      {/* Hero numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {headline.map((h) => (
          <div key={h.l} className="panel p-6 text-center">
            <div className="text-3xl font-bold text-accent-soft capitalize break-words">{h.v}</div>
            <div className="text-sm text-muted mt-1.5">{h.l}</div>
          </div>
        ))}
      </div>

      {stats.longestBinge && (
        <div className="panel p-5 mb-6 flex items-center gap-4">
          {stats.longestBinge.image && (
            <img src={img(stats.longestBinge.image)} alt="" className="w-16 h-24 object-cover rounded-lg shrink-0" />
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Самый долгий марафон</div>
            <div className="text-lg font-semibold">{stats.longestBinge.title_ru}</div>
            <div className="text-sm text-accent-soft mt-0.5">
              досмотрено до {stats.longestBinge.last_view_episode?.position} серии
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <TallyBars title="Топ жанров" items={stats.genres} />
        <TallyBars title="Студии" items={stats.studios} />
        <TallyBars title="Десятилетия" items={stats.decades} />
        <TallyBars title="Страны" items={stats.countries} />
      </div>

      {stats.topRated.length > 0 && (
        <div className="panel p-5 mt-6">
          <h2 className="text-base font-semibold mb-4">Самые высокие оценки в истории</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {stats.topRated.map((r) => (
              <Link
                key={r.id}
                to={`/release/${r.id}`}
                className="group text-left"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface border border-white/[0.06] group-hover:border-accent/40">
                  {r.image && <img src={img(r.image)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="text-xs text-text/85 mt-1 line-clamp-2">{r.title_ru}</div>
                <div className="text-[11px] text-accent-soft">★ {(r.grade ?? 0).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
