import { useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { approveTvPair } from '../api/tvPair'
import { useAuth } from '../store/auth'

// Сюда ведёт QR-код с телевизора: подтверждаем вход на ТВ своей сессией.
export default function TvLinkPage() {
  const [params] = useSearchParams()
  const { session } = useAuth()
  const [code, setCode] = useState((params.get('code') || '').replace(/\D/g, '').slice(0, 6))
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError('')
    try {
      await approveTvPair(code)
      setState('done')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 404 ? 'Код не найден или устарел — посмотри на экран телевизора, там уже новый.' : 'Не получилось. Попробуй ещё раз.')
      setState('error')
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="panel p-7">
        <h1 className="text-lg font-semibold mb-1">Вход на телевизоре</h1>
        {state === 'done' ? (
          <p className="text-sm text-muted mt-3">Готово — телевизор войдёт сам через пару секунд.</p>
        ) : (
          <>
            <p className="text-sm text-muted mb-5">
              Телевизор войдёт в аккаунт <span className="text-text">{session?.login}</span>.
              Код показан на его экране.
            </p>
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <input
                className="input text-center text-2xl tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="submit" className="btn-primary w-full" disabled={code.length !== 6 || state === 'sending'}>
                {state === 'sending' ? 'Подтверждаю…' : 'Войти на телевизоре'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
