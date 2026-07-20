import { useEffect, useState } from 'react'
import {
  connectShikimori,
  disconnectShikimori,
  getShikiStatus,
  type ShikiStatus,
} from '../api/notify'
import { useDesign } from '../lib/design'

/**
 * Подключение аккаунта Shikimori. Приложение зарегистрировано с «out of band»
 * редиректом: Shikimori показывает код на своей странице, его нужно перенести
 * сюда руками. Обратного вызова на наш домен при этом не требуется.
 */
export default function ShikimoriSettings() {
  const modern = useDesign() === 'modern'
  const [status, setStatus] = useState<ShikiStatus | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = () => { getShikiStatus().then(setStatus) }
  useEffect(refresh, [])

  if (!status || !status.configured) return null

  const connect = async () => {
    if (!code.trim()) return
    setBusy(true); setMsg('')
    const res = await connectShikimori(code.trim())
    setBusy(false)
    if (!res.nickname) {
      setMsg(
        `Код не подошёл: ${res.error}. Он одноразовый и живёт несколько минут — ` +
        'откройте страницу разрешения заново и вставьте свежий.',
      )
      return
    }
    setCode('')
    setMsg(`Подключено: ${res.nickname}`)
    refresh()
  }

  const disconnect = async () => {
    setBusy(true)
    await disconnectShikimori()
    setBusy(false); setMsg(''); refresh()
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">Shikimori</h2>
      <p className="text-xs text-muted mt-0.5 mb-4">
        Оценки и просмотренные серии будут попадать в список на Shikimori автоматически.
      </p>

      {status.connected ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Подключён аккаунт <span className="text-accent font-medium">{status.nickname}</span>
          </span>
          <button onClick={disconnect} disabled={busy} className="btn-ghost ml-auto !py-1.5 text-sm">
            Отключить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <a
            href={status.authorizeUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-block !py-2 text-sm"
          >
            Открыть страницу разрешения
          </a>
          <p className="text-xs text-muted">
            Разрешите доступ, скопируйте показанный код и вставьте его сюда.
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код с Shikimori"
              className="input flex-1"
            />
            <button onClick={connect} disabled={busy || !code.trim()} className="btn-primary !py-2 text-sm shrink-0">
              {busy ? '…' : 'Подключить'}
            </button>
          </div>
        </div>
      )}

      {msg && <div className="text-xs text-muted mt-3">{msg}</div>}
    </div>
  )
}
