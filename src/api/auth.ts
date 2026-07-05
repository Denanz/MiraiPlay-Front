import { api } from './client'

export interface SignInResponse {
  code: number
  profileToken?: { token: string }
  profile?: { id: number; login: string }
}

export async function signIn(login: string, password: string): Promise<SignInResponse> {
  const params = new URLSearchParams()
  params.append('login', login)
  params.append('password', password)
  const res = await api.post<SignInResponse>('/api/v1/auth/signIn', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}
