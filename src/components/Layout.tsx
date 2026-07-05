import { Outlet, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Navbar from './Navbar'
import BottomNav from './BottomNav'
import InstallPrompt from './InstallPrompt'
import ModernShell from './ModernShell'
import { useDesign } from '../lib/design'

const isNative = Capacitor.isNativePlatform()

export default function Layout() {
  const location = useLocation()
  const design = useDesign()

  if (design === 'modern') {
    return (
      <>
        <ModernShell />
        <InstallPrompt />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className={`pt-[calc(3.5rem+env(safe-area-inset-top))] ${isNative ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : ''}`}>
        {/* keyed on path → opacity-only fade on route change (no transform, so
            fixed children like the back-to-top button stay viewport-anchored) */}
        <div key={location.pathname} className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade">
          <Outlet />
        </div>
      </main>
      {isNative && <BottomNav />}
      <InstallPrompt />
    </div>
  )
}
