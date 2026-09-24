// Управление с пульта телевизора (сборка под Samsung Tizen).
//
// У пульта нет курсора, только стрелки, OK и «Назад». Интерфейс рассчитан на
// мышь и тач, поэтому навигацию делаем геометрически: по стрелке фокус уходит
// на ближайший видимый интерактивный элемент в эту сторону. Ссылки и кнопки
// нажимаются по OK сами (браузер превращает Enter в click).

declare global {
  interface Window {
    tizen?: {
      tvinputdevice?: { registerKey(name: string): void }
      application?: { getCurrentApplication(): { exit(): void; hide(): void } }
    }
  }
}

export const isTizenBuild = import.meta.env.MODE === 'tizen'

export const TV_KEY = {
  back: 10009,
  enter: 13,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
} as const

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
].join(',')

type Dir = 'left' | 'right' | 'up' | 'down'

function isVisible(el: HTMLElement, r: DOMRect): boolean {
  if (r.width < 2 || r.height < 2) return false
  const style = getComputedStyle(el)
  if (style.visibility === 'hidden' || style.opacity === '0') return false
  // pointer-events:none у слоя обычно значит «декоративный» — туда не ходим.
  if (style.pointerEvents === 'none') return false
  return true
}

/** Самое верхнее открытое модальное окно, если оно есть: навигация остаётся внутри него. */
function activeScope(): ParentNode {
  const layers = Array.prototype.slice.call(
    document.querySelectorAll('.fixed, [role="dialog"]'),
  ) as HTMLElement[]
  let best: HTMLElement | null = null
  let bestZ = 0
  for (const el of layers) {
    const style = getComputedStyle(el)
    if (style.position !== 'fixed' || style.display === 'none') continue
    const z = parseInt(style.zIndex, 10) || 0
    const r = el.getBoundingClientRect()
    // Только слои почти на весь экран: плавающие плашки и тосты — не модалки.
    if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.9) continue
    if (!el.querySelector(FOCUSABLE)) continue
    if (z >= 40 && z >= bestZ) { best = el; bestZ = z }
  }
  return best || document
}

function candidates(): Array<{ el: HTMLElement; r: DOMRect }> {
  const out: Array<{ el: HTMLElement; r: DOMRect }> = []
  const nodes = activeScope().querySelectorAll(FOCUSABLE)
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as HTMLElement
    const r = el.getBoundingClientRect()
    if (isVisible(el, r)) out.push({ el, r })
  }
  return out
}

function score(from: DOMRect, to: DOMRect, dir: Dir): number {
  const fcx = from.left + from.width / 2
  const fcy = from.top + from.height / 2
  const tcx = to.left + to.width / 2
  const tcy = to.top + to.height / 2
  let main: number
  let cross: number
  if (dir === 'right' || dir === 'left') {
    main = dir === 'right' ? to.left - from.right : from.left - to.right
    if ((dir === 'right' ? tcx <= fcx : tcx >= fcx)) return Infinity
    // Пересечение по вертикали — кандидат «в той же строке».
    const overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top)
    cross = overlap > 0 ? 0 : Math.abs(tcy - fcy)
  } else {
    main = dir === 'down' ? to.top - from.bottom : from.top - to.bottom
    if ((dir === 'down' ? tcy <= fcy : tcy >= fcy)) return Infinity
    const overlap = Math.min(from.right, to.right) - Math.max(from.left, to.left)
    cross = overlap > 0 ? 0 : Math.abs(tcx - fcx)
  }
  const along = dir === 'left' || dir === 'right' ? Math.abs(tcy - fcy) : Math.abs(tcx - fcx)
  return Math.max(0, main) + cross * 3 + along * 0.1
}

function focusEl(el: HTMLElement) {
  el.focus()
  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
  } catch {
    el.scrollIntoView(false)
  }
}

function move(dir: Dir): boolean {
  const current = document.activeElement as HTMLElement | null
  const list = candidates()
  if (!list.length) return false

  if (!current || current === document.body || !list.some((c) => c.el === current)) {
    // Ничего не выбрано — начинаем с первого элемента, видимого на экране.
    const onScreen = list.filter((c) => c.r.bottom > 0 && c.r.top < window.innerHeight)
    const first = (onScreen.length ? onScreen : list)
      .slice()
      .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)[0]
    focusEl(first.el)
    return true
  }

  const from = current.getBoundingClientRect()
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const c of list) {
    if (c.el === current) continue
    const s = score(from, c.r, dir)
    if (s < bestScore) { bestScore = s; best = c.el }
  }
  if (best) { focusEl(best); return true }
  return false
}

const DIRS: Record<number, Dir> = {
  [TV_KEY.left]: 'left',
  [TV_KEY.up]: 'up',
  [TV_KEY.right]: 'right',
  [TV_KEY.down]: 'down',
}

function onKeyDown(e: KeyboardEvent) {
  const dir = DIRS[e.keyCode]
  const target = e.target as HTMLElement | null

  if (dir) {
    // В полях ввода стрелки влево/вправо двигают курсор, а не фокус.
    const tag = target && target.tagName
    const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(checkbox|radio|range|button|submit)$/.test((target as HTMLInputElement).type))
    if (typing && (dir === 'left' || dir === 'right')) return
    if (tag === 'SELECT') return
    e.preventDefault()
    if (!move(dir)) {
      // Дальше фокусироваться некуда — хотя бы прокручиваем страницу.
      if (dir === 'down') window.scrollBy(0, window.innerHeight * 0.6)
      if (dir === 'up') window.scrollBy(0, -window.innerHeight * 0.6)
    }
    return
  }

  // OK по элементу, который не превращает Enter в click сам.
  if (e.keyCode === TV_KEY.enter && target && target !== document.body) {
    const tag = target.tagName
    if (tag !== 'A' && tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault()
      target.click()
    }
  }
}

/** Регистрирует медиаклавиши пульта (без этого Tizen их не отдаёт странице). */
function registerKeys() {
  const input = window.tizen && window.tizen.tvinputdevice
  if (!input) return
  const keys = [
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
    'MediaRewind', 'MediaFastForward', 'ChannelUp', 'ChannelDown',
  ]
  for (const k of keys) {
    try { input.registerKey(k) } catch { /* ключ может отсутствовать на модели */ }
  }
}

export function exitApp() {
  try {
    window.tizen && window.tizen.application && window.tizen.application.getCurrentApplication().exit()
  } catch { /* ignore */ }
}

let installed = false

export function installTvNavigation() {
  if (installed) return
  installed = true
  registerKeys()
  document.addEventListener('keydown', onKeyDown)
}
