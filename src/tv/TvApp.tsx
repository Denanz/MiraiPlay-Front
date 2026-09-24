// TV-версия MiraiPlay (сборка под Samsung Tizen): свой интерфейс под пульт в духе
// Netflix. Данные, вход и плеер — общие с вебом.
import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { TV_KEY, exitApp } from '../lib/tv'
import LoginPage from '../pages/LoginPage'
import { Icon, Spinner } from './parts'
import { useFocusMemory, lastContentElement } from './focus'
import './tv.css'

const TvHome = lazy(() => import('./TvHome'))
const TvRelease = lazy(() => import('./TvRelease'))
const TvSearch = lazy(() => import('./TvSearch'))
const TvLists = lazy(() => import('./TvLists'))
const TvSettings = lazy(() => import('./TvSettings'))
const PlayerPage = lazy(() => import('../pages/PlayerPage'))

const NAV = [
  { to: '/search', label: 'Поиск', icon: Icon.search },
  { to: '/home', label: 'Главная', icon: Icon.home },
  { to: '/lists', label: 'Мои списки', icon: Icon.lists },
  { to: '/settings', label: 'Настройки', icon: Icon.settings },
]
const ROOTS = NAV.map((n) => n.to)

/**
 * «Назад» на пульте. Во вложенных экранах — шаг назад по истории. На корневых:
 * если фокус в контенте — уходим в меню (как у Netflix), из меню — выход.
 * В плеере кнопку ловит сам iframe и присылает намерение «back».
 */
function BackKey() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.keyCode !== TV_KEY.back) return
      e.preventDefault()
      if (location.pathname === '/login') { exitApp(); return }
      if (!ROOTS.includes(location.pathname)) {
        if (location.key !== 'default') navigate(-1)
        else navigate('/home', { replace: true })
        return
      }
      const nav = document.querySelector('.tv-nav')
      if (nav && !nav.contains(document.activeElement)) {
        const current = nav.querySelector('.tv-nav-item.on') as HTMLElement | null
        if (current) { current.focus(); return }
      }
      exitApp()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, location])
  return null
}

/**
 * Меню живёт по своим правилам, а не по геометрии: вверх-вниз только по пунктам,
 * влево — некуда, вправо — обратно в контент, туда, где был фокус.
 */
function NavKeys() {
  const location = useLocation()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const nav = document.querySelector('.tv-nav')
      if (!nav || !nav.contains(document.activeElement)) return
      const items = Array.prototype.slice.call(nav.querySelectorAll('.tv-nav-item')) as HTMLElement[]
      const i = items.indexOf(document.activeElement as HTMLElement)
      let handled = true
      if (e.keyCode === TV_KEY.up) { if (i > 0) items[i - 1].focus() }
      else if (e.keyCode === TV_KEY.down) { if (i < items.length - 1) items[i + 1].focus() }
      else if (e.keyCode === TV_KEY.left) { /* дальше некуда */ }
      else if (e.keyCode === TV_KEY.right) { const el = lastContentElement(location.pathname); if (el) el.focus() }
      else handled = false
      if (handled) { e.preventDefault(); e.stopImmediatePropagation() }
    }
    // Пришли в меню из контента — встаём на текущий раздел, а не на ближайший по вертикали пункт.
    function onFocusIn(e: FocusEvent) {
      const nav = document.querySelector('.tv-nav')
      const from = e.relatedTarget as Node | null
      if (!nav || !nav.contains(e.target as Node) || (from && nav.contains(from))) return
      const current = nav.querySelector('.tv-nav-item.on') as HTMLElement | null
      if (current && current !== e.target) current.focus()
    }
    // Capture на window — раньше общей навигации из lib/tv.ts.
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [location.pathname])
  return null
}

function Shell() {
  useFocusMemory()
  return (
    <div className="tv-root">
      <NavKeys />
      <nav className="tv-nav">
        <img className="tv-nav-logo" src={`${import.meta.env.BASE_URL}brand-mark-128.png`} alt="" />
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `tv-nav-item${isActive ? ' on' : ''}`}>
            {n.icon}<span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="tv-main">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

// Общий код (например, lib/resume.ts) при сбое уводит на веб-экран выбора серии —
// на ТВ его роль играет экран тайтла.
function WatchRedirect() {
  const { id } = useParams()
  return <Navigate to={`/release/${id}`} replace />
}

function Private({ children }: { children: ReactNode }) {
  const { session, bootstrapping } = useAuth()
  if (bootstrapping) return <div className="tv-root"><Spinner /></div>
  return session ? <>{children}</> : <Navigate to="/login" replace />
}

export default function TvApp() {
  return (
    <>
      <BackKey />
      <Suspense fallback={<div className="tv-root"><Spinner /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/player" element={<Private><PlayerPage /></Private>} />
          <Route path="/" element={<Private><Shell /></Private>}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<TvHome />} />
            <Route path="search" element={<TvSearch />} />
            <Route path="lists" element={<TvLists />} />
            <Route path="settings" element={<TvSettings />} />
            <Route path="release/:id" element={<TvRelease />} />
            <Route path="watch/:id" element={<WatchRedirect />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
