import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/home', label: 'Главная',
    icon: <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />,
  },
  {
    to: '/browse', label: 'Каталог',
    icon: <><path d="M4 5h16M4 12h16M4 19h16" /></>,
  },
  {
    to: '/bookmarks', label: 'Закладки',
    icon: <path d="M6 4h12v16l-6-4-6 4z" />,
  },
  {
    to: '/schedule', label: 'Расписание',
    icon: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></>,
  },
  {
    to: '/stats', label: 'Профиль',
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>,
  },
]

// Нижняя панель вкладок, только на мобильных.
export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.07]
                    bg-bg/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} className="flex-1 flex flex-col items-center gap-1 pt-2 pb-1.5">
            {({ isActive }) => (
              <>
                <span className={`px-3.5 py-1 rounded-full transition-colors ${isActive ? 'bg-accent/20' : ''}`}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                       className={isActive ? 'text-accent' : 'text-muted'}>
                    {t.icon}
                  </svg>
                </span>
                <span className={`text-[11px] leading-none ${isActive ? 'text-accent font-medium' : 'text-muted'}`}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
