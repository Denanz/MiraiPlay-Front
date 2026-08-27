import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './store/auth'
import { applyTheme, currentThemeId } from './lib/theme'
import { installStaleChunkReload } from './lib/staleChunkReload'
import './index.css'

applyTheme(currentThemeId())
// До рендера: выкат мог случиться, пока вкладка была открыта.
installStaleChunkReload()

// Отдаём восстановление прокрутки странице (CatalogPage и т.п.), а не браузеру —
// иначе нативное восстановление конкурирует с ручным scrollTo и результат
// становится случайным (то 0, то нужная позиция).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Регистрируем service worker PWA, только в боевой сборке
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ })
  })
}
