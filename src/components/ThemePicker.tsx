import { useState } from 'react'
import { THEMES, applyTheme, currentThemeId, accentCss } from '../lib/theme'
import { useDesign } from '../lib/design'

export default function ThemePicker() {
  const [active, setActive] = useState(currentThemeId())
  const modern = useDesign() === 'modern'

  const pick = (id: string) => {
    applyTheme(id)
    setActive(id)
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold mb-1">Оформление</h2>
      <p className="text-xs text-muted mb-4">Цветовая схема сайта и приложения</p>
      <div className="flex flex-wrap gap-3">
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            title={t.name}
            className={`flex flex-col items-center gap-1.5 group`}
          >
            <span
              className={`w-11 h-11 rounded-full border-2 transition-transform group-active:scale-90 ${
                active === t.id ? 'border-text scale-105' : 'border-white/15'
              }`}
              style={{ background: `linear-gradient(135deg, ${accentCss(t.rgb[1])}, ${accentCss(t.rgb[0])})` }}
            >
              {active === t.id && <span className="text-[#130d1c] text-sm leading-[42px] font-bold">✓</span>}
            </span>
            <span className={`text-[11px] ${active === t.id ? 'text-text' : 'text-muted'}`}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
