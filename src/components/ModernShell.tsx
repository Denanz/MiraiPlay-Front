import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import '../styles/modern-kit.css'

interface Item { to: string; label: string; icon: string }

const NAV: Item[] = [
  { to: '/home', label: 'Главная', icon: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { to: '/browse', label: 'Каталог', icon: 'M4 5h16M4 12h16M4 19h16' },
  { to: '/search', label: 'Поиск', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5' },
  { to: '/bookmarks', label: 'Закладки', icon: 'M6 4h12v16l-6-4-6 4z' },
  { to: '/schedule', label: 'Расписание', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { to: '/gallery', label: 'Галерея', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 4-5 4 4' },
  { to: '/achievements', label: 'Ачивки', icon: 'M8 4h8v4a4 4 0 0 1-8 0zM10 15h4v4h-4z' },
  { to: '/diary', label: 'Дневник', icon: 'M6 4h11a1 1 0 0 1 1 1v15H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 8h6M9 12h6' },
  { to: '/pick', label: 'Выбери за меня', icon: 'M5 5h5v5H5zM14 14h5v5h-5zM7.5 14v5M16.5 5v5' },
  { to: '/stats', label: 'Профиль', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c0-3.5 3-6 7-6s7 2.5 7 6' },
  { to: '/settings', label: 'Настройки', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 4v2M12 18v2M4 12h2M18 12h2' },
]

// Нижняя панель на телефоне: только то, чем пользуются постоянно. Пять пунктов
// плюс «Ещё» — шесть слотов, ровно столько же, сколько было, так что панель не
// уплотняется. Остальное уходит в лист: на узком экране боковой рейл скрыт
// (@media max-width:860px), и без этого листа Галерея, Ачивки, Дневник,
// «Выбери за меня» и Настройки были недоступны с телефона вообще.
const BOTTOM = ['/home', '/browse', '/search', '/bookmarks', '/stats']
const MORE = ['/schedule', '/gallery', '/achievements', '/diary', '/pick', '/settings']

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24"><path d={d} /></svg>
}

export default function ModernShell() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  // Переход по ссылке из листа должен его закрывать.
  useEffect(() => { setMoreOpen(false) }, [location.pathname])
  return (
    <div className="min-h-screen bg-bg">
      <div className="md-aurora"><b /><b /><b /></div>

      <aside className="md-rail">
        <NavLink to="/browse" className="md-brand"><span className="dot" /> MiraiHub</NavLink>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icon d={n.icon} /> {n.label}
          </NavLink>
        ))}
        <div className="grow" />
      </aside>

      <main className="md-main">
        <div key={location.pathname} className="md-inner animate-fade">
          <Outlet />
        </div>
      </main>

      <nav className="md-bottom">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icon d={n.icon} /><span>{n.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={MORE.includes(location.pathname) || moreOpen ? 'on' : ''}
          aria-label="Ещё"
        >
          <Icon d="M5 12h.01M12 12h.01M19 12h.01" /><span>Ещё</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="md-more-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="md-more-sheet">
            {NAV.filter((n) => MORE.includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Icon d={n.icon} /><span>{n.label}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
