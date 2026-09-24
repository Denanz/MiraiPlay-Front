// Прокрутка и фокус в TV-интерфейсе.
//
// Переходы между элементами делает геометрическая навигация из lib/tv.ts. Здесь —
// то, как экран едет за фокусом: ряды сдвигаются трансформом (плавно и дёшево для
// слабого железа ТВ), а браузерный scroll, который делает сам focus(), тут же
// обнуляется.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

const ROW_FOCUSABLE = '[data-tv-item], button:not([disabled]), a[href]'

/** focus() сам докручивает overflow:hidden-контейнеры — у нас сдвиг делает transform. */
function resetScroll(e: React.UIEvent<HTMLElement>) {
  e.currentTarget.scrollTop = 0
  e.currentTarget.scrollLeft = 0
}

/** Вертикальная лента: активный ряд встаёт к верхнему краю области. */
export function TvScroller({ top, children, offset = 0 }: { top: number; children: ReactNode; offset?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [y, setY] = useState(0)

  function onFocus(e: React.FocusEvent) {
    const el = box.current
    if (!el) return
    el.scrollTop = 0
    const row = (e.target as HTMLElement).closest('[data-tv-row]') as HTMLElement | null
    if (!row || !el.contains(row)) return
    setY(Math.max(0, row.offsetTop - offset))
  }

  // Вверх/вниз — строго в соседний ряд. Геометрия тут не годится: ряд выше уже
  // уехал под баннер и обрезан, и она увела бы фокус на кнопки баннера.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.keyCode !== 38 && e.keyCode !== 40) return
    const el = box.current
    const from = e.target as HTMLElement
    const row = from.closest('[data-tv-row]')
    if (!el || !row) return
    const rows = Array.prototype.slice.call(el.querySelectorAll('[data-tv-row]')) as HTMLElement[]
    const withItems = rows.filter((r) => r === row || r.querySelector(ROW_FOCUSABLE))
    const i = withItems.indexOf(row as HTMLElement)
    const next = withItems[e.keyCode === 38 ? i - 1 : i + 1]
    if (!next) {
      // Вверх с первого ряда — пусть общая навигация уведёт на баннер; вниз с последнего — стоп.
      if (e.keyCode === 40) { e.preventDefault(); e.stopPropagation() }
      return
    }
    const fr = from.getBoundingClientRect()
    const cx = fr.left + fr.width / 2
    let best: HTMLElement | null = null
    let bestD = Infinity
    const items = next.querySelectorAll(ROW_FOCUSABLE)
    for (let k = 0; k < items.length; k++) {
      const it = items[k] as HTMLElement
      const r = it.getBoundingClientRect()
      if (r.width < 2) continue
      const d = Math.abs(r.left + r.width / 2 - cx)
      if (d < bestD) { bestD = d; best = it }
    }
    if (best) {
      e.preventDefault()
      e.stopPropagation()
      best.focus()
    }
  }

  return (
    <div className="tvs" style={{ top }} ref={box} onFocus={onFocus} onScroll={resetScroll} onKeyDown={onKeyDown}>
      <div className="tvs-track" style={{ transform: `translate3d(0, ${-y}px, 0)` }}>{children}</div>
    </div>
  )
}

/** Горизонтальный ряд: фокус держится у левого края, как у Netflix. */
export function TvRow({ title, children, empty, id, fixed }: {
  title?: ReactNode
  children: ReactNode
  empty?: ReactNode
  id?: string
  /** Ряд целиком помещается на экран (сетка) — не сдвигать. */
  fixed?: boolean
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)

  function onFocus(e: React.FocusEvent) {
    const vp = viewport.current
    if (!vp) return
    vp.scrollLeft = 0
    const item = (e.target as HTMLElement).closest('[data-tv-item]') as HTMLElement | null
    if (fixed || !item || !vp.contains(item)) return
    // Трек — offsetParent карточек (position: relative), 72 — его левый отступ.
    setX(Math.max(0, item.offsetLeft - 72))
  }

  const hasItems = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <section className="tvr" data-tv-row={id || ''}>
      {title && <h2 className="tvr-title">{title}</h2>}
      {hasItems ? (
        <div className="tvr-viewport" ref={viewport} onFocus={onFocus} onScroll={resetScroll}>
          <div className="tvr-track" style={{ transform: `translate3d(${-x}px, 0, 0)` }}>{children}</div>
        </div>
      ) : (
        empty && <div className="tvr-empty">{empty}</div>
      )}
    </section>
  )
}

// ── Запоминание фокуса ─────────────────────────────────────
// Вернулся «Назад» — фокус встаёт туда же, где был. Ключ — data-tv-key элемента.

const lastFocus: Record<string, string> = {}

/** Элемент контента, на котором фокус стоял последним на этом пути, — чтобы вернуться в него из меню. */
export function lastContentElement(path: string): HTMLElement | null {
  const main = document.querySelector('.tv-main')
  if (!main) return null
  const key = lastFocus[path]
  return (key && (main.querySelector(`[data-tv-key="${key.replace(/"/g, '')}"]`) as HTMLElement | null)) ||
    (main.querySelector('[data-tv-item]') as HTMLElement | null) ||
    (main.querySelector('button') as HTMLElement | null)
}

export function rememberFocus(path: string, key: string | null) {
  if (key) lastFocus[path] = key
}

/** Ставит фокус, когда экран готов: на запомненный элемент, на [data-tv-autofocus] или на первый элемент. */
export function useInitialFocus(ready: boolean) {
  const location = useLocation()
  const done = useRef(false)
  useLayoutEffect(() => { done.current = false }, [location.key])
  useEffect(() => {
    if (!ready || done.current) return
    const main = document.querySelector('.tv-main')
    if (!main) return
    const active = document.activeElement
    // Пользователь уже куда-то ушёл (например, в меню) — не дёргаем.
    if (active && active !== document.body && main.contains(active)) { done.current = true; return }
    const key = lastFocus[location.pathname]
    const pick = (sel: string) => main.querySelector(sel) as HTMLElement | null
    const el =
      (key && pick(`[data-tv-key="${key.replace(/"/g, '')}"]`)) ||
      pick('[data-tv-autofocus]:not([disabled])') ||
      pick('[data-tv-item]') ||
      pick('button:not([disabled]), a[href]')
    if (!el) return
    el.focus()
    // Неактивная кнопка фокус не берёт — попробуем на следующем рендере.
    done.current = document.activeElement === el
  })
}

/** Следит за фокусом внутри .tv-main и запоминает ключ для текущего пути. */
export function useFocusMemory() {
  const location = useLocation()
  useEffect(() => {
    function onFocus(e: FocusEvent) {
      const t = e.target as HTMLElement
      if (!t || !t.closest || !t.closest('.tv-main')) return
      const keyed = t.closest('[data-tv-key]') as HTMLElement | null
      rememberFocus(location.pathname, keyed && keyed.getAttribute('data-tv-key'))
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [location.pathname])
}
