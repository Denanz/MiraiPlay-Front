import { api } from './client'

function token(): string {
  return localStorage.getItem('anixart_token') || ''
}

// Stable account id — anchors this user's subscriber so notifications track
// their own watch lists (and their own Telegram), not whoever configured last.
function profileId(): string {
  return localStorage.getItem('anixart_user_id') || ''
}

export async function getNotifyChat(): Promise<string> {
  if (!token()) return ''
  try {
    const { data } = await api.get<{ chatId: string }>('/api/v1/notify/chat', {
      params: { token: token(), profileId: profileId() },
    })
    return data?.chatId || ''
  } catch {
    return ''
  }
}

// Returns { delivered } — whether the bot could actually message the chat
// (false usually means the user hasn't pressed /start in the bot yet).
export async function saveNotifyChat(chatId: string): Promise<{ delivered: boolean }> {
  const { data } = await api.post<{ ok: boolean; delivered: boolean }>('/api/v1/notify/chat', {
    chatId, token: token(), profileId: profileId(),
  })
  return { delivered: !!data?.delivered }
}
