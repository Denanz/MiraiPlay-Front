// Наборы акцентных цветов. Каждый — тройка RGB, которая уезжает в CSS-переменные.
export interface Theme { id: string; name: string; rgb: [string, string, string] }

// 'purple' и 'blue' — точные оттенки из градиента логотипа (не универсальный
// фиолетовый/синий), поскольку 'purple' используется по умолчанию везде,
// где акцент не выбран явно.
export const THEMES: Theme[] = [
  { id: 'purple', name: 'Фиолетовый', rgb: ['204 117 250', '222 169 250', '118 50 154'] },
  { id: 'blue',   name: 'Синий',      rgb: ['97 205 250', '156 224 252', '44 126 160'] },
  { id: 'cyan',   name: 'Бирюзовый',  rgb: ['34 211 238', '103 232 249', '20 130 150'] },
  { id: 'green',  name: 'Зелёный',    rgb: ['74 222 128', '134 239 172', '34 140 78'] },
  { id: 'amber',  name: 'Янтарный',   rgb: ['251 191 36', '253 224 71', '150 110 20'] },
  { id: 'orange', name: 'Оранжевый',  rgb: ['251 146 60', '253 186 116', '150 88 35'] },
  { id: 'rose',   name: 'Розовый',    rgb: ['244 114 182', '249 168 212', '150 60 110'] },
  { id: 'red',    name: 'Красный',    rgb: ['248 113 113', '252 165 165', '150 55 55'] },
  { id: 'slate',  name: 'Стальной',   rgb: ['148 163 184', '203 213 225', '90 100 120'] },
]

const KEY = 'miraihub_theme'

// Разовый перенос со старого ключа, чтобы не потерять выбранную тему.
try {
  const old = localStorage.getItem('anixartex_theme')
  if (old && !localStorage.getItem(KEY)) localStorage.setItem(KEY, old)
  if (old) localStorage.removeItem('anixartex_theme')
} catch { /* ignore */ }

export function applyTheme(id: string) {
  const t = THEMES.find(x => x.id === id) || THEMES[0]
  const s = document.documentElement.style
  s.setProperty('--accent-rgb', t.rgb[0])
  s.setProperty('--accent-soft-rgb', t.rgb[1])
  s.setProperty('--accent-dim-rgb', t.rgb[2])
  localStorage.setItem(KEY, t.id)
  // Дублируем в плоские ключи для инлайн-скрипта, который красит до отрисовки
  localStorage.setItem('th_accent', t.rgb[0])
  localStorage.setItem('th_accent-soft', t.rgb[1])
  localStorage.setItem('th_accent-dim', t.rgb[2])
}

export function currentThemeId(): string {
  return localStorage.getItem(KEY) || 'purple'
}

export function accentCss(rgb: string, alpha = 1): string {
  // rgba() с запятыми, а не `rgb(r g b / a)`: старый Chromium на ТВ Tizen
  // понимает только такую запись.
  return `rgba(${rgb.trim().split(/[\s,]+/).join(', ')}, ${alpha})`
}
