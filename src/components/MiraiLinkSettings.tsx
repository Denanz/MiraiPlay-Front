import { useEffect, useState } from 'react'
import { getMiraiLinkStatus, linkMirai, unlinkMirai, type MiraiLinkStatus } from '../api/miraiLink'
import { useDesign } from '../lib/design'

/**
 * Привязка к единому аккаунту Mirai. Смысл — избавиться от входа по Anixart:
 * привязанный пользователь попадает в MiraiPlay сразу по сессии хаба. Токен
 * Anixart при этом остаётся нужен (им ходят в каталог и списки) и хранится на
 * сервере, поэтому привязка — явная кнопка, а не побочный эффект входа.
 *
 * Блок не показывается, если сессии Mirai нет: в APK её не бывает (куки домена
 * туда не попадают), и предлагать там привязку бессмысленно.
 */
export default function MiraiLinkSettings() {
  const modern = useDesign() === 'modern'
  const [status, setStatus] = useState<MiraiLinkStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = () => { getMiraiLinkStatus().then(setStatus) }
  useEffect(refresh, [])

  if (!status || !status.available) return null

  const connect = async () => {
    setBusy(true); setMsg('')
    const res = await linkMirai()
    setBusy(false)
    setMsg(res.ok ? 'Привязано.' : 'Не удалось привязать.')
    refresh()
  }

  const disconnect = async () => {
    setBusy(true); setMsg('')
    await unlinkMirai()
    setBusy(false)
    refresh()
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">Аккаунт Mirai</h2>
      <p className="text-xs text-muted mt-0.5 mb-4">
        Привяжи аккаунт — и MiraiPlay будет открываться сразу, без входа по Anixart,
        как остальные сервисы Mirai. Токен Anixart останется нужен для каталога и списков,
        он будет храниться на сервере.
      </p>

      {status.linked ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Привязан аккаунт <b>{status.login}</b>
            <span className="text-muted"> · вход без пароля</span>
          </span>
          <button onClick={disconnect} disabled={busy} className="btn-ghost ml-auto !py-1.5 text-sm">
            Отвязать
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text/80">Сейчас вход только по логину Anixart.</span>
          <button onClick={connect} disabled={busy} className="btn-primary ml-auto !py-2 text-sm shrink-0">
            {busy ? '…' : 'Привязать'}
          </button>
        </div>
      )}

      {msg && <div className="text-xs text-muted mt-3">{msg}</div>}
    </div>
  )
}
