import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth'
import { getProfile } from '../api/profile'
import { getWatchedReleases } from '../api/episodes'
import { evaluate, TIER_STYLE, type AchContext, type EvaluatedAchievement } from '../data/achievements'
import Spinner from '../components/Spinner'
import { useDesign } from '../lib/design'
import '../styles/modern-achievements.css'

export default function AchievementsPage() {
  const design = useDesign()
  const { session } = useAuth()
  const [list, setList] = useState<EvaluatedAchievement[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onlyUnlocked, setOnlyUnlocked] = useState(false)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([
      getProfile(session.userId),
      getWatchedReleases().catch(() => []),
    ])
      .then(([profile, watched]) => {
        if (!profile) { setError('Не удалось загрузить профиль'); return }
        const registerYears = profile.register_date
          ? (Date.now() - profile.register_date * 1000) / (365 * 24 * 3600 * 1000)
          : 0
        const ctx: AchContext = {
          episodes: profile.watched_episode_count ?? 0,
          minutes: profile.watched_time ?? 0,
          completed: profile.completed_count ?? 0,
          watching: profile.watching_count ?? 0,
          plan: profile.plan_count ?? 0,
          dropped: profile.dropped_count ?? 0,
          holdOn: profile.hold_on_count ?? 0,
          favorite: profile.favorite_count ?? 0,
          ratings: profile.rating_score ?? 0,
          comments: profile.comment_count ?? 0,
          collections: profile.collection_count ?? 0,
          videos: profile.video_count ?? 0,
          friends: profile.friend_count ?? 0,
          registerYears,
          genres: profile.preferred_genres ?? [],
          watched,
        }
        setList(evaluate(ctx))
      })
      .catch(() => setError('Не удалось загрузить ачивки'))
      .finally(() => setLoading(false))
  }, [session])

  const unlocked = useMemo(() => list?.filter(a => a.unlocked).length ?? 0, [list])
  const total = list?.length ?? 0

  const grouped = useMemo(() => {
    if (!list) return []
    const filtered = onlyUnlocked ? list.filter(a => a.unlocked) : list
    const map = new Map<string, EvaluatedAchievement[]>()
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, [])
      map.get(a.category)!.push(a)
    }
    // unlocked first, then by progress within each category
    for (const arr of map.values()) {
      arr.sort((x, y) => Number(y.unlocked) - Number(x.unlocked) || y.pct - x.pct)
    }
    return [...map.entries()]
  }, [list, onlyUnlocked])

  if (loading) return <Spinner variant="grid" />
  if (error || !list) return <div className="text-center text-muted py-20 text-sm">{error || 'Нет данных'}</div>

  if (design === 'modern') {
    const pct = total ? Math.round((unlocked / total) * 100) : 0
    return (
      <div>
        <div className="mdk-rowhead" style={{ margin: '0 0 26px' }}>
          <div>
            <h1 className="text-3xl font-display font-semibold">Достижения</h1>
            <div className="text-sm text-muted mt-1">получено {unlocked} из {total}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setOnlyUnlocked(v => !v)} className={`mdk-chip ${onlyUnlocked ? 'mdk-chip-acc' : ''}`}>
              {onlyUnlocked ? 'Показать все' : 'Только открытые'}
            </button>
            <div className="mdk-glass" style={{ padding: '12px 20px' }}>
              <span className="mdk-metric"><span className="mdk-n" style={{ fontSize: 22, color: 'rgb(var(--accent-rgb))' }}>{pct}%</span></span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <div className="mdk-rowhead">
                <h2>{category} <b>{items.filter(i => i.unlocked).length} / {items.length}</b></h2>
              </div>
              <div className="mdk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
                {items.map(a => (
                  <div key={a.id} className={`mdp-ach-card mdk-glass ${a.unlocked ? '' : 'mdp-lock'}`}>
                    <div className="mdp-ach-ic">{a.unlocked ? a.icon : '🔒'}</div>
                    <div style={{ flex: 1 }}>
                      <h4>{a.title}</h4>
                      <p>{a.desc}</p>
                      {a.unlocked ? (
                        <div className="mdp-ach-pct">✓ получено</div>
                      ) : a.target > 1 ? (
                        <>
                          <div className="mdp-ach-bar"><i style={{ width: `${a.pct}%` }} /></div>
                          <div className="mdp-ach-pct">{a.progress} / {a.target}</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="text-xl font-bold">Достижения</h1>
        <span className="chip chip-active">{unlocked} / {total}</span>
        <button
          onClick={() => setOnlyUnlocked(v => !v)}
          className={`chip ${onlyUnlocked ? 'chip-active' : ''} ml-auto`}
        >
          {onlyUnlocked ? 'Показать все' : 'Только открытые'}
        </button>
      </div>

      {/* Overall progress */}
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-8">
        <div className="h-full bg-accent transition-all" style={{ width: `${total ? (unlocked / total) * 100 : 0}%` }} />
      </div>

      <div className="space-y-8">
        {grouped.map(([category, items]) => (
          <section key={category}>
            <h2 className="text-base font-semibold mb-3">
              {category}
              <span className="text-xs text-muted font-normal ml-2">
                {items.filter(i => i.unlocked).length} / {items.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(a => {
                const style = TIER_STYLE[a.tier]
                return (
                  <div
                    key={a.id}
                    className={`panel p-3 flex items-center gap-3 ring-1 ${a.unlocked ? style.ring : 'ring-white/[0.05]'} ${a.unlocked ? '' : 'opacity-60'}`}
                  >
                    <div className={`text-2xl shrink-0 ${a.unlocked ? '' : 'grayscale'}`}>{a.unlocked ? a.icon : '🔒'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm truncate ${a.unlocked ? style.text : ''}`}>{a.title}</span>
                      </div>
                      <div className="text-xs text-muted truncate">{a.desc}</div>
                      {!a.unlocked && a.target > 1 && (
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full bg-accent/70" style={{ width: `${a.pct}%` }} />
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">{a.progress} / {a.target}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
