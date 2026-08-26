import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useAuth } from './store/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import UpdatePrompt from './components/UpdatePrompt'

// Hardware back-button (Android). Without this, Capacitor's default closes the
// app on every back press. We navigate the in-app history instead, and only
// minimize the app when we're at a top-level page (nothing left to pop).
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


// Search lives inside Catalog now — old /search links (bookmarks, the native
// app's deep-link handler above) redirect there, keeping any ?q= intact.
function SearchRedirect() {
  const location = useLocation()
  return <Navigate to={`/browse${location.search}`} replace />
}

// Route-level code splitting: each page ships as its own chunk, loaded on demand
// (kept tiny by gzip + immutable caching), so the initial bundle stays small.
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
  const { session } = useAuth()
  return session ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <NativeBackButton />
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
          {/* Not linked from any nav menu — owner-only, gated by its own admin key. */}
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
