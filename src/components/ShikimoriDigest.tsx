import { useEffect, useState } from 'react'
import { getShikiProfile, type ShikiProfileDigest } from '../api/notify'
import { useDesign } from '../lib/design'

/**
 * Сводка профиля со стороны Shikimori. Блок целиком исчезает, если аккаунт
 * не подключён — предлагать подключение здесь незачем, это дело настроек.
 */
export default function ShikimoriDigest() {
  const modern = useDesign() === 'modern'
  const [p, setP] = useState<ShikiProfileDigest | null>(null)

  useEffect(() => {
    let cancelled = false
    getShikiProfile().then((d) => { if (!cancelled) setP(d) })
    return () => { cancelled = true }
  }, [])

  if (!p) return null

  const totalScored = p.scores.reduce((n, s) => n + s.count, 0)
  // Средняя оценка считается по распределению: сумма (оценка × сколько раз) / всего.
  const avg = totalScored
    ? (p.scores.reduce((n, s) => n + s.score * s.count, 0) / totalScored).toFixed(2)
    : null
  const maxScore = Math.max(1, ...p.scores.map((s) => s.count))

  return (
    <div className={`min-w-0 overflow-hidden ${modern ? 'mdk-glass mdk-pad mb-8' : 'panel p-5 mb-8'}`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {p.avatar && (
          <img src={p.avatar} alt="" className="w-11 h-11 rounded-full shrink-0" loading="lazy" />
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">
            Shikimori · <span className="text-accent">{p.nickname}</span>
          </h2>
          <div className="text-xs text-muted truncate">
            {[p.lastOnline, ...p.about].filter(Boolean).join(' · ')}
          </div>
        </div>
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost ml-auto shrink-0 !py-1.5 text-sm whitespace-nowrap"
          >
            Профиль ↗
          </a>
        )}
      </div>

      {p.statuses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {p.statuses.map((s) => (
            <div key={s.name} className="rounded-lg bg-white/[0.04] px-3 py-2 min-w-0">
              <div className="text-lg font-bold text-accent-soft leading-tight">{s.size}</div>
              <div className="text-xs text-muted whitespace-nowrap">{s.name}</div>
            </div>
          ))}
        </div>
      )}

      {p.scores.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap items-baseline gap-x-2 mb-2">
            <h3 className="text-xs uppercase tracking-wide text-muted">Оценки</h3>
            {avg && <span className="text-xs text-muted">средняя {avg} · всего {totalScored}</span>}
          </div>
          <div className="space-y-1.5">
            {p.scores.map((s) => (
              <div key={s.score} className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted tabular-nums text-right">{s.score}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, (s.count / maxScore) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-muted tabular-nums text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.types.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted mb-2">По типам</h3>
          <div className="flex flex-wrap gap-1.5">
            {p.types.map((t) => (
              <span key={t.name} className="px-2.5 py-1 rounded-full bg-white/[0.05] text-xs">
                {t.name} <span className="text-muted">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
