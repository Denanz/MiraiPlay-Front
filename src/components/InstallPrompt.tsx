import { useEffect, useState } from 'react'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Native "Add to home screen" prompt for installable PWA (Android/Chromium).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_install_dismissed') === '1')

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferred || dismissed) return null

  const install = async () => {
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch { /* ignore */ }
    setDeferred(null)
  }
  const close = () => { setDismissed(true); localStorage.setItem('pwa_install_dismissed', '1') }

  return (
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-5 sm:w-80 z-40
                    panel p-3 flex items-center gap-3 shadow-2xl border-accent/20">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-accent/20 text-accent flex items-center justify-center">📲</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Установить MiraiHub</div>
        <div className="text-xs text-muted">Быстрый запуск с домашнего экрана</div>
      </div>
      <button onClick={install} className="chip chip-active shrink-0">Установить</button>
      <button onClick={close} className="text-muted hover:text-text shrink-0 px-1" aria-label="Закрыть">✕</button>
    </div>
  )
}
