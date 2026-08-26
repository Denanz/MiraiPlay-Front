import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { signIn } from '../api/auth'
import { useAuth } from '../store/auth'

export default function LoginPage() {
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { session, bootstrapping, login } = useAuth()
  const navigate = useNavigate()

  // Автовход мог сработать, пока страница уже открыта — тогда форма здесь ни к
  // чему.
  useEffect(() => {
    if (session) navigate('/home', { replace: true })
  }, [session, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signIn(loginVal, password)
      if (data.code === 0 && data.profileToken && data.profile) {
        login(data.profileToken.token, data.profile.id, data.profile.login)
        navigate('/home')
      } else {
        setError('Неверный логин или пароль')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Ошибка: ${msg}`)
    } finally {
      setLoading(false)
    }
  }


  if (bootstrapping) return null
  if (session) return <Navigate to="/home" replace />
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                      rounded-full bg-accent/10 blur-[120px]" />

      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center mb-8">
          <img src="/brand-wordmark.png" alt="MiraiPlay" className="h-10 w-auto" />
        </div>

        <div className="panel p-7">
          <h2 className="text-lg font-semibold mb-1">Вход</h2>
          <p className="text-sm text-muted mb-6">Войдите в свой аккаунт Anixart</p>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Логин</label>
              <input
                type="text"
                value={loginVal}
                onChange={e => setLoginVal(e.target.value)}
                required
                autoComplete="username"
                className="input"
                placeholder="Ваш логин"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
