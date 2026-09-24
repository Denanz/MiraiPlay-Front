import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { signIn } from '../api/auth'
import { useAuth } from '../store/auth'
import { isTizenBuild } from '../lib/tv'
import TvPairLogin from '../components/TvPairLogin'

export default function LoginPage() {
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(!isTizenBuild)
  const { session, bootstrapping, login } = useAuth()
  const navigate = useNavigate()
  // Куда вернуть после входа: PrivateRoute кладёт сюда исходную страницу
  // (например, /tv?code=… из QR-кода телевизора).
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/home'

  // Автовход мог сработать, пока страница уже открыта — тогда форма здесь ни к
  // чему.
  useEffect(() => {
    if (session) navigate(from, { replace: true })
  }, [session, navigate, from])

  const onTvSession = useCallback((token: string, userId: number, userLogin: string) => {
    login(token, userId, userLogin)
    navigate('/home', { replace: true })
  }, [login, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signIn(loginVal, password)
      if (data.code === 0 && data.profileToken && data.profile) {
        login(data.profileToken.token, data.profile.id, data.profile.login)
        navigate(from)
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
  if (session) return <Navigate to={from} replace />
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                      rounded-full bg-accent/10 blur-[120px]" />

      <div className={`w-full relative ${showForm ? 'max-w-sm' : 'flex flex-col items-center'}`}>
        <div className="flex items-center justify-center mb-8">
          <img src={`${import.meta.env.BASE_URL}brand-wordmark.png`} alt="MiraiPlay" className="h-10 w-auto" />
        </div>

        {!showForm && (
          <>
            <TvPairLogin onSession={onTvSession} />
            <button type="button" className="btn-ghost mt-8" onClick={() => setShowForm(true)}>
              Войти по логину и паролю
            </button>
          </>
        )}

        {showForm && <div className="panel p-7">
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
        </div>}
      </div>
    </div>
  )
}
