import { useEffect, useState } from 'react'
import { getNotifyChat, saveNotifyChat } from '../api/notify'
import { useDesign } from '../lib/design'

type Status = { kind: 'idle' | 'ok' | 'warn' | 'err'; text: string }

export default function NotifySettings() {
  const [chatId, setChatId] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' })
  const modern = useDesign() === 'modern'

  useEffect(() => {
    getNotifyChat().then((id) => { if (id) setChatId(id) }).catch(() => {})
  }, [])

  const save = async () => {
    const clean = chatId.trim()
    if (!/^-?\d{3,20}$/.test(clean)) {
      setStatus({ kind: 'err', text: 'chat_id — это число (например 123456789).' })
      return
    }
    setSaving(true)
    setStatus({ kind: 'idle', text: '' })
    try {
      const { delivered } = await saveNotifyChat(clean)
      setStatus(delivered
        ? { kind: 'ok', text: '✅ Сохранено и проверено — тестовое сообщение отправлено в Telegram.' }
        : { kind: 'warn', text: '⚠ Сохранено, но бот не смог написать. Открой @MiraiHubBot и нажми /start, затем сохрани ещё раз.' })
    } catch {
      setStatus({ kind: 'err', text: 'Не удалось сохранить. Попробуй позже.' })
    } finally {
      setSaving(false)
    }
  }

  const statusColor = status.kind === 'ok' ? 'text-green-400'
    : status.kind === 'warn' ? 'text-amber-400'
    : status.kind === 'err' ? 'text-red-400' : 'text-muted'

  return (
    <section className={modern ? 'mdk-glass mdk-pad' : 'panel p-5 sm:p-6'}>
      <h2 className="text-base font-semibold mb-1">Уведомления в Telegram</h2>
      <p className="text-xs text-muted mb-4">Бот пришлёт, когда выйдет новая серия из твоих списков «Смотрю» / «В планах».</p>

      <ol className="text-sm text-text/80 space-y-1.5 mb-4 list-decimal list-inside">
        <li>Открой бота <a href="https://t.me/MiraiHubBot" target="_blank" rel="noreferrer" className="text-accent hover:underline">@MiraiHubBot</a> и нажми <code className="px-1 rounded bg-white/[0.08]">/start</code>.</li>
        <li>Узнай свой <b>chat_id</b>: напиши боту <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-accent hover:underline">@userinfobot</a> — он пришлёт число (это и есть твой id).</li>
        <li>Вставь это число ниже и нажми «Сохранить».</li>
      </ol>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value.replace(/[^\d-]/g, ''))}
          inputMode="numeric"
          placeholder="Например: 123456789"
          className="input sm:max-w-xs"
        />
        <button onClick={save} disabled={saving} className="btn-primary shrink-0">
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
      {status.text && <p className={`text-xs mt-2 ${statusColor}`}>{status.text}</p>}
    </section>
  )
}
