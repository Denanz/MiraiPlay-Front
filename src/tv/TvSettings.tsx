import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { THEMES, applyTheme, currentThemeId } from '../lib/theme'
import { TvRow, useInitialFocus } from './focus'

export default function TvSettings() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(currentThemeId())
  useInitialFocus(true)

  return (
    <div className="tvpage">
      <h1>Настройки</h1>
      <p>Вы вошли как <b style={{ color: '#f5f0ff' }}>{session ? session.login : '—'}</b></p>

      <div style={{ marginLeft: -72, marginTop: 40 }}>
        <TvRow id="theme" title="Акцентный цвет">
          {THEMES.map((t) => (
            <button key={t.id} data-tv-item data-tv-key={`theme:${t.id}`}
              className={`tvchip${theme === t.id ? ' on' : ''}`}
              {...(theme === t.id ? { 'data-tv-autofocus': true } : {})}
              onClick={() => { applyTheme(t.id); setTheme(t.id) }}>
              <span style={{
                display: 'inline-block', width: 18, height: 18, borderRadius: 9, marginRight: 12, verticalAlign: -2,
                background: `rgb(${t.rgb[0].split(' ').join(',')})`,
              }} />
              {t.name}
            </button>
          ))}
        </TvRow>
        <TvRow id="account" title="Аккаунт" fixed>
          <button data-tv-item data-tv-key="logout" className="tvchip"
            onClick={() => { logout(); navigate('/login', { replace: true }) }}>
            Выйти из аккаунта
          </button>
        </TvRow>
      </div>
    </div>
  )
}
