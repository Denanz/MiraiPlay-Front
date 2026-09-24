import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useAuth } from './store/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import UpdatePrompt from './components/UpdatePrompt'
import { isTizenBuild, TV_KEY, exitApp } from './lib/tv'

// Аппаратная кнопка «назад». По умолчанию Capacitor закрывает приложение на
// каждом нажатии; вместо этого ходим по своей истории и сворачиваемся, только
// когда возвращаться уже некуда.
const ROOT_PATHS = ['/home', '/browse', '/bookmarks', '/schedule', '/stats', '/login']
function NativeBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const atRoot = ROOT_PATHS.includes(location.pathname)
      if (canGoBack && !atRoot) navigate(-1)
      else CapacitorApp.minimizeApp()
    }).then((h) => { handle = h })
    return () => { handle?.remove() }
  }, [navigate, location.pathname])
  return null
}

// Кнопка «Назад» на пульте телевизора (Tizen): та же логика, что и на Android.
function TvBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!isTizenBuild) return
    function onKey(e: KeyboardEvent) {
      if (e.keyCode !== TV_KEY.back) return
      e.preventDefault()
      const atRoot = ROOT_PATHS.includes(location.pathname)
      if (location.key !== 'default' && !atRoot) navigate(-1)
      else exitApp()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, location])
  return null
}

// Поиск переехал в каталог, старые ссылки /search ведут туда же вместе с ?q=.
function SearchRedirect() {
  const location = useLocation()
  return <Navigate to={`/browse${location.search}`} replace />
}

// Каждая страница едет отдельным чанком и грузится по требованию, чтобы стартовый
// бандл оставался маленьким.
const HomePage = lazy(() => import('./pages/HomePage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const ReleasePage = lazy(() => import('./pages/ReleasePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const DiaryPage = lazy(() => import('./pages/DiaryPage'))
const PickPage = lazy(() => import('./pages/PickPage'))
const WrappedPage = lazy(() => import('./pages/WrappedPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const TvLinkPage = lazy(() => import('./pages/TvLinkPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const DesignPreviewV5 = lazy(() => import('./pages/DesignPreviewV5'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
    </div>
  )
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center text-center px-4">
          <div className="panel p-8 max-w-sm">
            <p className="text-red-400 text-lg font-semibold mb-2">Ошибка страницы</p>
            <p className="text-muted text-sm mb-5 break-words">{this.state.error}</p>
            <button
              className="btn-primary"
              onClick={() => { this.setState({ error: null }); history.back() }}
            >
              ← Назад
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { session, bootstrapping } = useAuth()
  // Пока идёт автовход по аккаунту Mirai, редиректить на логин нельзя.
  const location = useLocation()
  if (bootstrapping) return <RouteFallback />
  return session
    ? <>{children}</>
    : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <NativeBackButton />
      <TvBackButton />
      <UpdatePrompt />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Public guest entry for Watch Together — no login required */}
        <Route path="/room/:code" element={<PlayerPage />} />
        {/* Player is full-screen (no app navbar) — kept outside Layout so its
            own header/overlay isn't trapped under the navbar's stacking context */}
        <Route path="/player" element={<PrivateRoute><PlayerPage /></PrivateRoute>} />
        {/* Прототип #5 — своя вёрстка, без Layout/навбара сайта. Не в навигации, не коммитим. */}
        <Route path="/design-preview-v5" element={<PrivateRoute><DesignPreviewV5 /></PrivateRoute>} />
<Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="browse" element={<CatalogPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="search" element={<SearchRedirect />} />
          <Route path="achievements" element={<AchievementsPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="release/:id" element={<ReleasePage />} />
          <Route path="watch/:id" element={<WatchPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="diary" element={<DiaryPage />} />
          <Route path="pick" element={<PickPage />} />
          <Route path="wrapped" element={<WrappedPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="changelog" element={<ChangelogPage />} />
          <Route path="tv" element={<TvLinkPage />} />
          {/* Not linked from any nav menu — owner-only, gated by its own admin key. */}
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
