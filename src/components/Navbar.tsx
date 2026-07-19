import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../store/auth'

const mainLinks = [
  { to: '/home', label: 'Главная' },
  { to: '/browse', label: 'Каталог' },
  { to: '/bookmarks', label: 'Закладки' },
  { to: '/search', label: 'Поиск' },
]

const moreLinks = [
  { to: '/schedule', label: 'Расписание' },
  { to: '/achievements', label: 'Ачивки' },
  { to: '/gallery', label: 'Галерея' },
  { to: '/diary', label: 'Дневник' },
  { to: '/pick', label: 'Выбери за меня' },
  { to: '/settings', label: 'Настройки' },
]

const allLinks = [...mainLinks, ...moreLinks]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm transition-colors ${
    isActive ? 'text-text bg-white/[0.06]' : 'text-muted hover:text-text'
  }`

// Native app uses the bottom tab bar instead of the hamburger menu.
const isNative = Capacitor.isNativePlatform()

export default function Navbar() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-bg/80 backdrop-blur-xl
                    pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <NavLink to="/home" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent-rgb)/0.8)]" />
          <span className="font-display text-base font-bold tracking-tight text-text">
            Mirai<span className="text-accent">Hub</span>
          </span>
        </NavLink>

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center gap-1">
          {mainLinks.map(l => (
            <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
          ))}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1 ${
                moreOpen ? 'text-text bg-white/[0.06]' : 'text-muted hover:text-text'
              }`}
            >
              Прочее <span className="text-[10px]">▾</span>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 mt-2 z-50 min-w-[160px] py-1.5 rounded-xl bg-[#14111f] border border-white/10 shadow-xl">
                  {moreLinks.map(l => (
                    <NavLink key={l.to} to={l.to} onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `block px-4 py-2 text-sm transition-colors ${
                          isActive ? 'text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'
                        }`}>
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Desktop right side ── */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {session && (
            <NavLink to="/stats"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-accent' : 'text-muted hover:text-text'}`}
              title="Профиль">
              {session.login}
            </NavLink>
          )}
          <button onClick={handleLogout} className="text-sm text-muted hover:text-red-400 transition-colors">
            Выйти
          </button>
        </div>

        {/* ── Mobile hamburger (WEB only — the native app uses the bottom tab bar) ── */}
        {!isNative && (
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl border border-white/15 bg-white/[0.06] active:bg-white/[0.12] shrink-0"
            aria-label="Меню"
          >
            <span className={`block w-5 h-[2px] rounded-full bg-text transition-transform duration-200 ${mobileOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`block w-5 h-[2px] rounded-full bg-text transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-[2px] rounded-full bg-text transition-transform duration-200 ${mobileOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
          </button>
        )}
      </div>
    </nav>

      {/* ── Mobile dropdown panel (web only) ── */}
      {!isNative && mobileOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] bg-[#08060e] overflow-y-auto top-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="px-4 py-4 flex flex-col gap-2">
            {session && (
              <NavLink to="/stats" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] mb-1">
                <span className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold">
                  {session.login.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="text-sm font-semibold text-text">{session.login}</div>
                  <div className="text-xs text-muted">Профиль и статистика</div>
                </div>
                <span className="ml-auto text-muted">›</span>
              </NavLink>
            )}
            {allLinks.map(l => (
              <NavLink key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3.5 rounded-xl text-[15px] font-medium border transition-colors ${
                    isActive
                      ? 'text-accent bg-accent/[0.12] border-accent/30'
                      : 'text-text bg-white/[0.04] border-white/[0.07] active:bg-white/[0.08]'
                  }`}>
                {l.label}
                <span className="ml-auto text-muted">›</span>
              </NavLink>
            ))}
            <button onClick={handleLogout}
              className="flex items-center px-4 py-3.5 rounded-xl text-[15px] font-medium text-red-400 bg-red-500/[0.06] border border-red-500/20 active:bg-red-500/[0.12] mt-1">
              Выйти
            </button>
          </div>
        </div>
      )}
    </>
  )
}
