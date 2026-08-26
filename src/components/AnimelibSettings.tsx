import { useEffect, useState } from 'react'
import { getAnimelibStatus, saveAnimelibToken, disconnectAnimelib, type AnimelibStatus } from '../api/animelib'
import { useDesign } from '../lib/design'

/**
 * AnimeLib не даёт зарегистрировать OAuth-приложение (в отличие от Shikimori) —
 * единственный путь подключить свой аккаунт здесь — вставить токен из своей же
 * уже залогиненной сессии в браузере. Инструкция ниже — ровно те шаги, которыми
 * это делается вручную.
 *
 * Refresh-токен необязателен, но с ним это разовая операция вместо ежемесячной:
 * сервер сам обновляет 31-дневный access. Приватное окно в инструкции — не
 * перестраховка: обновление отзывает старый refresh, поэтому у сервера должна
 * быть своя цепочка, а «Выйти» убивает её целиком.
 */
export default function AnimelibSettings() {
  const modern = useDesign() === 'modern'
  const [status, setStatus] = useState<AnimelibStatus | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [refreshInput, setRefreshInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = () => { getAnimelibStatus().then(setStatus) }
  useEffect(refresh, [])

  if (!status) return null

  const daysLeft = status.expiresAt ? Math.max(0, Math.round((status.expiresAt - Date.now()) / 86400000)) : null

  const connect = async () => {
    if (!tokenInput.trim()) return
    setBusy(true); setMsg('')
    const res = await saveAnimelibToken(tokenInput.trim(), refreshInput.trim() || undefined)
    setBusy(false)
    if (!res.ok) { setMsg('Не удалось сохранить токен.'); return }
    setTokenInput('')
    setRefreshInput('')
    setMsg(res.autoRenew ? 'Подключено — токен будет обновляться сам.' : 'Подключено.')
    refresh()
  }

  const disconnect = async () => {
    setBusy(true)
    await disconnectAnimelib()
    setBusy(false); setMsg(''); refresh()
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">AnimeLib HD</h2>
      <p className="text-xs text-muted mt-0.5 mb-4">
        У части тайтулов на AnimeLib есть собственный плеер с честным 1080p — заметно лучше,
        чем у обычных Kodik-раздач. Доступен только с личным токеном аккаунта AnimeLib.
      </p>

      {status.connected ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Токен сохранён
            {status.autoRenew ? (
              <span className="text-muted"> · обновляется автоматически</span>
            ) : daysLeft !== null && (
              <span className="text-muted"> · истекает через {daysLeft} дн.</span>
            )}
          </span>
          <button onClick={disconnect} disabled={busy} className="btn-ghost ml-auto !py-1.5 text-sm">
            Отключить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ol className="text-sm text-text/80 space-y-1.5 list-decimal list-inside">
            <li>Открой <a href="https://animelib.org/" target="_blank" rel="noreferrer" className="text-accent hover:underline">animelib.org</a> в <b>приватном окне</b>.</li>
            <li>Открой DevTools (F12) → вкладка Network, фильтр <code className="px-1 rounded bg-white/[0.08]">oauth/token</code>.</li>
            <li>Войди в аккаунт — появится POST-запрос <code className="px-1 rounded bg-white/[0.08]">auth/oauth/token</code>. Открой его вкладку Response.</li>
            <li>Скопируй оттуда <code className="px-1 rounded bg-white/[0.08]">access_token</code> и <code className="px-1 rounded bg-white/[0.08]">refresh_token</code> в поля ниже.</li>
            <li>Закрой приватное окно, <b>не нажимая «Выйти»</b> — выход отзывает токен.</li>
          </ol>
          <div className="space-y-2">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="access_token"
              className="input w-full"
              type="password"
            />
            <div className="flex gap-2">
              <input
                value={refreshInput}
                onChange={(e) => setRefreshInput(e.target.value)}
                placeholder="refresh_token — чтобы не вставлять заново каждый месяц"
                className="input flex-1"
                type="password"
              />
              <button onClick={connect} disabled={busy || !tokenInput.trim()} className="btn-primary !py-2 text-sm shrink-0">
                {busy ? '…' : 'Подключить'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Токен хранится на сервере и даёт доступ к твоему аккаунту AnimeLib — вставляй, только если доверяешь этому серверу.
          </p>
        </div>
      )}

      {msg && <div className="text-xs text-muted mt-3">{msg}</div>}
    </div>
  )
}
