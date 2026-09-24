// PostCSS-заплатки для Chromium 63 (телевизоры Samsung на Tizen 5.0).
// Подключается только в сборке `--mode tizen`, веб и Android их не видят.
//
// Чего нет в Chromium 63 и что мы эмулируем:
//   inset          (Chrome 87) → top/right/bottom/left
//   gap у grid     (Chrome 66) → grid-gap / grid-row-gap / grid-column-gap
//   gap у flex     (Chrome 84) → margin у соседних детей (приближённо, без учёта переноса строк)
//   aspect-ratio   (Chrome 88) → float-распорка через ::before с padding-top в процентах
//   rgb(r g b / a) (Chrome 65) → rgba(r, g, b, a); переменные --*-rgb хранятся
//                   через запятую (в рантайме это делает tizen/early.js)

const GAP_CLASS = /^\.((?:[\w-]+\\:)*)gap(-x|-y)?-/

/** Индекс закрывающей скобки для открывающей на позиции `open`. */
function matchParen(str, open) {
  let depth = 0
  for (let i = open; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')' && --depth === 0) return i
  }
  return -1
}

/** Делит строку по символу `ch` только на верхнем уровне скобок. */
function splitTop(str, ch) {
  const out = []
  let depth = 0
  let last = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    else if (str[i] === ch && depth === 0) { out.push(str.slice(last, i)); last = i + 1 }
  }
  out.push(str.slice(last))
  return out
}

function commaChannels(channels) {
  const c = channels.trim()
  if (c.includes(',') || /^var\(/.test(c)) return c
  return c.split(/\s+/).join(', ')
}

/** rgb(A B C / D), rgb(var(--x) / D), rgb(A B C) → запись, понятная Chromium 63. */
export function legacyColors(value) {
  let out = ''
  let i = 0
  const re = /\brgba?\(/g
  let m
  while ((m = re.exec(value))) {
    const open = m.index + m[0].length - 1
    const close = matchParen(value, open)
    if (close < 0) break
    const inner = legacyColors(value.slice(open + 1, close))
    const [channels, alpha] = splitTop(inner, '/')
    let fn
    if (alpha !== undefined) fn = `rgba(${commaChannels(channels)}, ${alpha.trim()})`
    else fn = `${m[0].slice(0, -1)}(${commaChannels(channels)})`
    out += value.slice(i, m.index) + fn
    i = close + 1
    re.lastIndex = close + 1
  }
  return out + value.slice(i)
}

const RGB_VAR = /^--[\w-]*-rgb$/

function splitSelectors(selector) {
  return selector.split(',').map((s) => s.trim()).filter(Boolean)
}

function expandInset(decl) {
  const parts = decl.value.trim().split(/\s+/)
  const [t, r = t, b = t, l = r] = parts
  decl.cloneBefore({ prop: 'top', value: t })
  decl.cloneBefore({ prop: 'right', value: r })
  decl.cloneBefore({ prop: 'bottom', value: b })
  decl.cloneBefore({ prop: 'left', value: l })
  decl.remove()
}

function expandInsetAxis(decl) {
  const [a, b = a] = decl.value.trim().split(/\s+/)
  const [p1, p2] = decl.prop === 'inset-inline' ? ['left', 'right'] : ['top', 'bottom']
  decl.cloneBefore({ prop: p1, value: a })
  decl.cloneBefore({ prop: p2, value: b })
  decl.remove()
}

function gapValues(rule) {
  let row = null
  let col = null
  rule.walkDecls((d) => {
    if (d.prop === 'gap') {
      const [r, c = r] = d.value.trim().split(/\s+/)
      row = r; col = c
    } else if (d.prop === 'row-gap') row = d.value.trim()
    else if (d.prop === 'column-gap') col = d.value.trim()
  })
  return { row, col }
}

function flexGapRules(postcss, rule) {
  const { row, col } = gapValues(rule)
  const out = []
  for (const sel of splitSelectors(rule.selector)) {
    // Tailwind-утилита: flex-контейнер определяется соседним классом.
    if (GAP_CLASS.test(sel)) {
      if (col && col !== '0' && col !== '0px') {
        out.push(postcss.rule({
          selector: `.flex${sel}:not(.flex-col)>*+*:not(.ml-auto):not(.mx-auto),.inline-flex${sel}:not(.flex-col)>*+*:not(.ml-auto):not(.mx-auto)`,
          nodes: [postcss.decl({ prop: 'margin-left', value: col })],
        }))
      }
      if (row && row !== '0' && row !== '0px') {
        out.push(postcss.rule({
          selector: `.flex-col${sel}>*+*:not(.mt-auto):not(.my-auto)`,
          nodes: [postcss.decl({ prop: 'margin-top', value: row })],
        }))
      }
    }
  }
  if (out.length) return out

  // Своё CSS: display:flex и gap в одном правиле.
  let display = null
  let direction = null
  rule.walkDecls((d) => {
    if (d.prop === 'display') display = d.value.trim()
    if (d.prop === 'flex-direction') direction = d.value.trim()
  })
  if (display !== 'flex' && display !== 'inline-flex') return []
  const column = direction === 'column' || direction === 'column-reverse'
  const value = column ? row : col
  if (!value || value === '0' || value === '0px') return []
  const selector = splitSelectors(rule.selector).map((s) => `${s}>*+*`).join(',')
  return [postcss.rule({ selector, nodes: [postcss.decl({ prop: column ? 'margin-top' : 'margin-left', value })] })]
}

function aspectRules(postcss, rule, decl) {
  const m = decl.value.trim().match(/^([\d.]+)\s*(?:\/\s*([\d.]+))?$/)
  if (!m) return []
  const w = parseFloat(m[1])
  const h = m[2] ? parseFloat(m[2]) : 1
  if (!w || !h) return []
  const pct = `${+((h / w) * 100).toFixed(4)}%`
  const sels = splitSelectors(rule.selector).filter((s) => !/::?(before|after)|\bimg\b/.test(s))
  if (!sels.length) return []
  return [
    postcss.rule({
      selector: sels.map((s) => `${s}::before`).join(','),
      nodes: [
        postcss.decl({ prop: 'content', value: '""' }),
        postcss.decl({ prop: 'float', value: 'left' }),
        postcss.decl({ prop: 'width', value: '0' }),
        postcss.decl({ prop: 'padding-top', value: pct }),
      ],
    }),
    postcss.rule({
      selector: sels.map((s) => `${s}::after`).join(','),
      nodes: [
        postcss.decl({ prop: 'content', value: '""' }),
        postcss.decl({ prop: 'display', value: 'block' }),
        postcss.decl({ prop: 'clear', value: 'both' }),
      ],
    }),
  ]
}

/** @type {() => import('postcss').Plugin} */
export default function tizenCssCompat() {
  return {
    postcssPlugin: 'tizen-css-compat',
    OnceExit(root, { postcss }) {
      root.walkRules((rule) => {
        const inKeyframes = rule.parent && rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)
        const extra = []
        rule.walkDecls((decl) => {
          if (RGB_VAR.test(decl.prop)) decl.value = commaChannels(decl.value)
          else if (/\brgba?\(/.test(decl.value)) decl.value = legacyColors(decl.value)
          if (inKeyframes) return

          if (decl.prop === 'inset') expandInset(decl)
          else if (decl.prop === 'inset-inline' || decl.prop === 'inset-block') expandInsetAxis(decl)
          else if (decl.prop === 'gap' || decl.prop === 'row-gap' || decl.prop === 'column-gap') {
            decl.cloneBefore({ prop: `grid-${decl.prop}` })
          } else if (decl.prop === 'aspect-ratio') {
            extra.push(...aspectRules(postcss, rule, decl))
          }
        })
        if (!inKeyframes && rule.some((n) => n.type === 'decl' && /^(gap|row-gap|column-gap)$/.test(n.prop))) {
          extra.push(...flexGapRules(postcss, rule))
        }
        if (extra.length) rule.after(extra)
      })
    },
  }
}
