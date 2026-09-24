import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Release } from '../api/releases'
import { Billboard, Icon, SkeletonRow, TvCard } from './parts'
import { TvRow, TvScroller, useInitialFocus } from './focus'

export interface BrowseItem {
  release: Release
  badge?: ReactNode
  progress?: number
  /** Своё действие по OK (например, «продолжить» сразу в плеер). По умолчанию — карточка тайтла. */
  onPick?: () => void
}

export interface BrowseRow {
  id: string
  title: ReactNode
  /** null — ещё грузится. */
  items: BrowseItem[] | null
  empty?: ReactNode
}

/**
 * Экран в духе Netflix: сверху баннер с тайтлом, на котором сейчас фокус, ниже
 * ряды постеров. Кнопки баннера относятся к тому же тайтлу.
 */
export default function TvBrowse({ rows, kicker, fallback, ready = true }: {
  rows: BrowseRow[]
  /** Ставить первый фокус, только когда верхние ряды уже на месте, иначе они сдвинут экран. */
  ready?: boolean
  kicker?: ReactNode
  /** Что показать в баннере, пока фокус ещё ни на чём не стоял. */
  fallback?: Release | null
}) {
  const navigate = useNavigate()
  const [focused, setFocused] = useState<BrowseItem | null>(null)
  const firstReady = rows.find((r) => r.items && r.items.length > 0)
  const shown = focused || (fallback ? { release: fallback } : firstReady ? firstReady.items![0] : null)

  useInitialFocus(ready && !!firstReady)

  const openRelease = (r: Release) => navigate(`/release/${r.id}`)
  const play = (it: BrowseItem) => (it.onPick ? it.onPick() : navigate(`/release/${it.release.id}`, { state: { autoplay: true } }))

  return (
    <>
      <Billboard release={shown ? shown.release : null} kicker={kicker}>
        {shown && (
          <div className="tv-actions">
            <button className="tv-btn primary" data-tv-key="bb-play" onClick={() => play(shown)}>
              {Icon.play}Смотреть
            </button>
            <button className="tv-btn" data-tv-key="bb-info" onClick={() => openRelease(shown.release)}>
              {Icon.info}Подробнее
            </button>
          </div>
        )}
      </Billboard>
      <TvScroller top={600}>
        {rows.map((row) => (
          <TvRow key={row.id} id={row.id} title={row.title} empty={row.items ? row.empty : undefined}>
            {row.items === null
              ? [<SkeletonRow key="s" />]
              : row.items.map((it) => (
                <TvCard
                  key={`${row.id}:${it.release.id}`}
                  tvKey={`${row.id}:${it.release.id}`}
                  release={it.release}
                  badge={it.badge}
                  progress={it.progress}
                  onFocusItem={() => setFocused(it)}
                  onPick={() => (it.onPick ? it.onPick() : openRelease(it.release))}
                />
              ))}
          </TvRow>
        ))}
      </TvScroller>
    </>
  )
}
