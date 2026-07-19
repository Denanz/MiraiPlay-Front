import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { getLatestVersion, type AppVersion } from '../api/appUpdate'

const DISMISS_KEY = 'miraihub_update_dismissed'

// Сборки по 28-ю включительно подписаны отладочным ключом. Начиная с 29 (2.8)
// приложение подписывается собственным ключом MiraiHub, а Android не разрешает
// обновление пакета через смену подписи: скачивание пройдёт, а установка молча
// провалится с «Приложение не установлено». Поэтому таким пользователям нужен
// не обычный баннер, а объяснение, что старую версию сначала надо удалить.
const LAST_DEBUG_SIGNED_BUILD = 28

// Native-only "an update is available" banner. The sideloaded APK can't update
// itself from a store, so on launch we compare the installed build with the
// latest version advertised by the backend and offer a download link.
export default function UpdatePrompt() {
  const [info, setInfo] = useState<AppVersion | null>(null)
  const [needsReinstall, setNeedsReinstall] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    ;(async () => {
      try {
        const [installed, latest] = await Promise.all([
          CapacitorApp.getInfo(),
          getLatestVersion(),
        ])
        if (cancelled || !latest) return
        const current = Number(installed.build) || 0
        if (latest.versionCode <= current) return
        const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0)
        if (!latest.mandatory && dismissed >= latest.versionCode) return
        setNeedsReinstall(current > 0 && current <= LAST_DEBUG_SIGNED_BUILD)
        setInfo(latest)
      } catch {
        /* never block startup on a failed update check */
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!info) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(info.versionCode))
    setInfo(null)
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-2">
      <div className={`mx-auto max-w-md p-3.5 flex items-center gap-3 rounded-2xl bg-elevated shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7)] ${
        needsReinstall ? 'border border-amber-400/50' : 'border border-accent/40'
      }`}>
        <div className="flex-1 min-w-0">
          {needsReinstall ? (
            <>
              <div className="text-sm font-semibold text-amber-300">
                Обновление v{info.versionName} — нужно переустановить
              </div>
              <div className="text-xs text-muted mt-0.5">
                Обновиться поверх не получится: у приложения сменился ключ подписи.
                Удалите старую версию и установите заново. Войти придётся снова, но
                прогресс, оценки и скриншоты вернутся — они привязаны к аккаунту.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Доступно обновление · v{info.versionName}</div>
              {info.notes && <div className="text-xs text-muted mt-0.5 line-clamp-2">{info.notes}</div>}
            </>
          )}
        </div>
        <a
          href={info.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary !py-2 shrink-0 text-sm"
        >
          Скачать
        </a>
        {!info.mandatory && (
          <button onClick={dismiss} className="text-muted hover:text-text shrink-0 px-1 text-lg leading-none" aria-label="Скрыть">
            ×
          </button>
        )}
      </div>
    </div>
  )
}
