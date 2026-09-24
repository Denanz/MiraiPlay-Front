import { useEffect, useState } from 'react'
import { startTvPair, pollTvPair, TV_LINK_URL } from '../api/tvPair'

const POLL_MS = 3000

/**
 * Экран входа на телевизоре: код и QR вместо логина с паролем. Пользователь
 * сканирует QR телефоном (где уже вошёл) и подтверждает — ТВ забирает сессию
 * опросом. Истёкший код тихо заменяется новым.
 */
export default function TvPairLogin({ onSession }: {
  onSession: (token: string, userId: number, login: string) => void
}) {
  const [code, setCode] = useState('')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll(secret: string) {
      if (cancelled) return
      try {
        const r = await pollTvPair(secret)
        if (cancelled) return
        if (r.status === 'ok') { onSession(r.token, r.userId, r.login); return }
        if (r.status === 'expired') { setRound((n) => n + 1); return }
      } catch { /* сеть моргнула — просто спросим ещё раз */ }
      timer = setTimeout(() => poll(secret), POLL_MS)
    }

    setError('')
    startTvPair()
      .then(async (p) => {
        if (cancelled) return
        setCode(p.code)
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(`${TV_LINK_URL}?code=${p.code}`, { margin: 1, width: 320 })
        if (!cancelled) setQr(url)
        poll(p.secret)
      })
      .catch(() => {
        if (cancelled) return
        setError('Не удалось получить код. Проверь подключение к интернету.')
        timer = setTimeout(() => setRound((n) => n + 1), 10_000)
      })

    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [round, onSession])

  return (
    <div className="panel p-10 flex items-center" style={{ maxWidth: 880 }}>
      <div className="shrink-0 rounded-2xl bg-white p-3" style={{ width: 320 + 24, height: 320 + 24 }}>
        {qr && <img src={qr} alt="" width={320} height={320} />}
      </div>
      <div className="ml-10">
        <h2 className="text-3xl font-semibold mb-3">Вход по телефону</h2>
        {error ? (
          <p className="text-red-300 text-lg">{error}</p>
        ) : (
          <>
            <p className="text-lg text-muted mb-6">
              Отсканируй QR-код телефоном, на котором ты уже вошёл в MiraiPlay, и подтверди вход.
              Или открой <span className="text-text">anime.denanz.fun/tv</span> и введи код:
            </p>
            <div className="font-display text-6xl tracking-[0.3em] text-accent">
              {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
