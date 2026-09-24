import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './store/auth'
import { applyTheme, currentThemeId } from './lib/theme'
import { installStaleChunkReload } from './lib/staleChunkReload'
import { isTizenBuild, installTvNavigation } from './lib/tv'
import './index.css'

applyTheme(currentThemeId())
// До рендера: выкат мог случиться, пока вкладка была открыта.
installStaleChunkReload()

// Отдаём восстановление прокрутки странице (CatalogPage и т.п.), а не браузеру —
// иначе нативное восстановление конкурирует с ручным scrollTo и результат
// становится случайным (то 0, то нужная позиция).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Tizen-приложение открывается с file://, где обычные пути не работают — там
// роутинг через #/, а навигация с пульта.
const Router = isTizenBuild ? HashRouter : BrowserRouter
if (isTizenBuild) installTvNavigation()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
)

// Регистрируем service worker PWA, только в боевой сборке
if ('serviceWorker' in navigator && import.meta.env.PROD && !isTizenBuild) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ })
  })
}
