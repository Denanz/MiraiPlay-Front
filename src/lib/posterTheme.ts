// Подкраска интерфейса под постер открытого тайтла.
//
// Акцент в теме задан RGB-триплетами (--accent-rgb и производные), поэтому
// подмена точечная: посчитали цвет постера — переопределили переменные на
// корне, ушли со страницы — вернули как было.
//
// Постеры отдаются с нашего же прокси и с CORS для домена приложения, так что
// canvas читается. Но если картинка не загрузилась или холст всё же оказался
// «испачкан», просто не красим — тема остаётся стандартной.

// Помимо акцента подменяем два тона авроры — большой размытой подложки страницы.
// Раньше она была зашита фиолетовым и не менялась, из-за чего перекрашенные
// кнопки спорили с фоном: сам постер красный, а вокруг сиреневое свечение.
const VARS = [
  '--accent-rgb',
  '--accent-soft-rgb',
  '--accent-dim-rgb',
  '--aurora-a-rgb',
  '--aurora-b-rgb',
  '--aurora-c-rgb',
] as const

type Rgb = [number, number, number]

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
  else if (max === G) h = ((B - R) / d + 2) / 6
  else h = ((R - G) / d + 4) / 6
  return [h, s, l]
}

function fromHsl(h: number, s: number, l: number): Rgb {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
  ]
}

/**
 * Доминирующий «живой» цвет постера. Серое, почти чёрное и почти белое
 * отбрасываем: акцент из них получается грязный и нечитаемый на тёмном фоне.
 */
function pickAccent(data: Uint8ClampedArray, minSat = 0.25): Rgb | null {
  const buckets = new Map<string, { count: number; sum: Rgb }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue // прозрачное
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
    const [, s, l] = toHsl(rgb)
    if (s < minSat || l < 0.1 || l > 0.93) continue
    // Огрубляем до сетки, иначе каждый пиксель — свой «цвет».
    const key = `${rgb[0] >> 4}:${rgb[1] >> 4}:${rgb[2] >> 4}`
    const b = buckets.get(key)
    if (b) { b.count++; b.sum[0] += rgb[0]; b.sum[1] += rgb[1]; b.sum[2] += rgb[2] }
    else buckets.set(key, { count: 1, sum: [...rgb] })
  }
  let best: { count: number; sum: Rgb } | null = null
  for (const b of buckets.values()) if (!best || b.count > best.count) best = b
  if (!best) return null
  return [
    Math.round(best.sum[0] / best.count),
    Math.round(best.sum[1] / best.count),
    Math.round(best.sum[2] / best.count),
  ]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('image failed'))
    im.src = src
  })
}

/** Считает акцент по постеру. null — если не вышло; вызывающий просто не красит. */
export async function accentFromPoster(src: string): Promise<Rgb | null> {
  if (!src) return null
  try {
    const im = await loadImage(src)
    // 48px по ширине достаточно: нужен преобладающий тон, а не детали.
    const w = 48
    const h = Math.max(1, Math.round((im.naturalHeight / im.naturalWidth) * w)) || 48
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(im, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    // Постепенно ослабляем требования к насыщенности: на приглушённых и
    // почти монохромных обложках строгий порог не находил ничего, и такие
    // тайтлы оставались с темой по умолчанию. Цвет должен быть у каждого.
    for (const minSat of [0.25, 0.15, 0.08, 0]) {
      const hit = pickAccent(data, minSat)
      if (hit) return hit
    }
    return null
  } catch {
    // Не загрузилось или холст «испачкан» — молча остаёмся на обычной теме.
    return null
  }
}

/**
 * Применяет акцент к корню документа. Возвращает функцию отката — её нужно
 * вызвать при уходе со страницы, иначе цвет тайтла утечёт на весь остальной
 * интерфейс.
 */
export function applyAccent(rgb: Rgb): () => void {
  const root = document.documentElement
  const previous = VARS.map((v) => [v, root.style.getPropertyValue(v)] as const)
  const [h, s, l] = toHsl(rgb)
  // Держим насыщенность и светлоту в рабочем диапазоне: акцент лежит на тёмном
  // фоне и используется для текста, поэтому слишком тусклый или тёмный не годится.
  const sat = Math.min(0.85, Math.max(0.45, s))
  const base = fromHsl(h, sat, Math.min(0.78, Math.max(0.6, l)))
  const soft = fromHsl(h, sat, 0.82)
  const dim = fromHsl(h, sat * 0.8, 0.42)
  root.style.setProperty('--accent-rgb', base.join(' '))
  root.style.setProperty('--accent-soft-rgb', soft.join(' '))
  root.style.setProperty('--accent-dim-rgb', dim.join(' '))

  // Аврора: три пятна вокруг того же тона. Расходятся по кругу, чтобы фон не
  // выглядел одноцветным, но оставались одного семейства с акцентом.
  const wrap = (x: number) => (x + 1) % 1
  root.style.setProperty('--aurora-a-rgb', fromHsl(h, Math.min(0.8, sat), 0.5).join(' '))
  root.style.setProperty('--aurora-b-rgb', fromHsl(wrap(h + 0.08), Math.min(0.75, sat), 0.45).join(' '))
  root.style.setProperty('--aurora-c-rgb', fromHsl(wrap(h - 0.1), Math.min(0.6, sat * 0.9), 0.4).join(' '))
  return () => {
    for (const [name, value] of previous) {
      if (value) root.style.setProperty(name, value)
      else root.style.removeProperty(name)
    }
  }
}
