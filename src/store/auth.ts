import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { fetchMiraiSession } from '../api/miraiLink'

interface Session {
  token: string
  userId: number
  login: string
}

interface AuthContextValue {
  session: Session | null
  // Идёт ли ещё попытка автовхода по аккаунту Mirai. Пока идёт, экран логина
  // показывать нельзя — иначе привязанный пользователь будет видеть его вспышку
  // на каждой загрузке.
  bootstrapping: boolean
  login: (token: string, userId: number, userLogin: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredSession(): Session | null {
  const token = localStorage.getItem('anixart_token')
  const userId = localStorage.getItem('anixart_user_id')
  const userLogin = localStorage.getItem('anixart_login')
  if (token && userId && userLogin) {
    return { token, userId: parseInt(userId, 10), login: userLogin }
  }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(getStoredSession)
  const [bootstrapping, setBootstrapping] = useState(() => getStoredSession() === null)

  const login = useCallback((token: string, userId: number, userLogin: string) => {
    localStorage.setItem('anixart_token', token)
    localStorage.setItem('anixart_user_id', String(userId))
    localStorage.setItem('anixart_login', userLogin)
    setSession({ token, userId, login: userLogin })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('anixart_token')
    localStorage.removeItem('anixart_user_id')
    localStorage.removeItem('anixart_login')
    setSession(null)
  }, [])

  // Автовход: если своей сессии нет, но аккаунт Mirai привязан — заходим без
  // экрана логина. Разово при старте; выход руками сюда не возвращает, иначе
  // «Выйти» немедленно логинило бы обратно.
  useEffect(() => {
    if (!bootstrapping) return
    let cancelled = false
    fetchMiraiSession()
      .then((s) => { if (!cancelled && s) login(s.token, s.userId, s.login) })
      .finally(() => { if (!cancelled) setBootstrapping(false) })
    return () => { cancelled = true }
  }, [])

  return React.createElement(
    AuthContext.Provider,
    { value: { session, bootstrapping, login, logout } },
    children
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
