import React, { createContext, useContext, useState, useCallback } from 'react'

interface Session {
  token: string
  userId: number
  login: string
}

interface AuthContextValue {
  session: Session | null
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

  return React.createElement(
    AuthContext.Provider,
    { value: { session, login, logout } },
    children
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
