// Отрисовка «Года в просмотре» в одну картинку для шеринга.
//
// Рисуем на canvas вручную, а не снимаем DOM: снятие DOM требует внешней
// библиотеки, тянет за собой шрифты и стили и всё равно даёт непредсказуемый
// результат. Здесь же полный контроль и ноль зависимостей.
//
// Постеры намеренно не рисуем — они приходят с другого домена, и любой сбой
// CORS «испачкал» бы холст, после чего картинку нельзя было бы выгрузить.

export interface WrappedCard {
  login: string
  episodes: string
  hours: string
  titles: string
  genre: string
  binge?: { title: string; episode?: number } | null
}

const W = 1080
const H = 1350

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Ужимает шрифт, пока строка не влезет в ширину — длинные названия не обрезаем. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, weight = '700') {
  let size = start
  do {
    ctx.font = `${weight} ${size}px "Inter", system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 2
  } while (size > 16)
  return size
}

export function renderWrappedCard(card: WrappedCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Фон — вертикальный градиент в тон тёмной теме приложения.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#171226')
  bg.addColorStop(1, '#0a0812')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Мягкое свечение сверху — тот же акцент, что и в интерфейсе.
  const glow = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, 620)
  glow.addColorStop(0, 'rgba(167,139,250,0.28)')
  glow.addColorStop(1, 'rgba(167,139,250,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 760)

  ctx.textAlign = 'center'

  ctx.fillStyle = '#c4a5fd'
  ctx.font = '600 34px "Inter", system-ui, sans-serif'
  ctx.fillText('MiraiPlay', W / 2, 110)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 76px "Inter", system-ui, sans-serif'
  ctx.fillText('Год в просмотре', W / 2, 210)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '400 34px "Inter", system-ui, sans-serif'
  ctx.fillText(card.login, W / 2, 268)

  // Четыре числа сеткой 2×2.
  const cells: Array<[string, string]> = [
    [card.episodes, 'серий просмотрено'],
    [card.hours, 'часов за просмотром'],
    [card.titles, 'тайтлов в истории'],
    [card.genre, 'любимый жанр'],
  ]
  const cw = 452, ch = 232, gap = 32
  const left = (W - (cw * 2 + gap)) / 2
  const top = 340

  cells.forEach(([value, label], i) => {
    const x = left + (i % 2) * (cw + gap)
    const y = top + Math.floor(i / 2) * (ch + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    roundRect(ctx, x, y, cw, ch, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 2
    roundRect(ctx, x, y, cw, ch, 28)
    ctx.stroke()

    ctx.fillStyle = '#c4a5fd'
    const size = fitText(ctx, value, cw - 60, 74, '800')
    ctx.font = `800 ${size}px "Inter", system-ui, sans-serif`
    ctx.fillText(value, x + cw / 2, y + ch / 2 + 6)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 26px "Inter", system-ui, sans-serif'
    ctx.fillText(label, x + cw / 2, y + ch - 34)
  })

  // Самый долгий марафон — если он вообще есть.
  if (card.binge?.title) {
    const y = top + ch * 2 + gap * 2 + 24
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    roundRect(ctx, left, y, cw * 2 + gap, 190, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, left, y, cw * 2 + gap, 190, 28)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '600 24px "Inter", system-ui, sans-serif'
    ctx.fillText('САМЫЙ ДОЛГИЙ МАРАФОН', W / 2, y + 52)

    ctx.fillStyle = '#ffffff'
    const size = fitText(ctx, card.binge.title, cw * 2 + gap - 80, 46)
    ctx.font = `700 ${size}px "Inter", system-ui, sans-serif`
    ctx.fillText(card.binge.title, W / 2, y + 112)

    if (card.binge.episode) {
      ctx.fillStyle = '#c4a5fd'
      ctx.font = '400 28px "Inter", system-ui, sans-serif'
      ctx.fillText(`досмотрено до ${card.binge.episode} серии`, W / 2, y + 156)
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '400 26px "Inter", system-ui, sans-serif'
  ctx.fillText('anime.denanz.fun', W / 2, H - 60)

  return canvas
}

/** Отдаёт картинку пользователю: системным «поделиться», иначе — скачиванием. */
export async function shareWrappedCard(card: WrappedCard): Promise<void> {
  const canvas = renderWrappedCard(card)
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const file = new File([blob], 'miraiplay-wrapped.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Год в просмотре' })
      return
    } catch {
      // Отмена или отказ системы — тихо падаем в скачивание.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'miraiplay-wrapped.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
