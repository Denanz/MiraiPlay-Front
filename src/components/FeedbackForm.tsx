import { useState } from 'react'
import { sendFeedback } from '../api/notify'
import { useDesign } from '../lib/design'

// Свободный ввод "где" превращался в "что-то где-то" — человек, который уже
// расстроен багом, не хочет придумывать формулировку. Список из разделов сайта
// не решает всё (сам баг может быть в другом месте, отсюда «Другое»), но
// избавляет от лишнего шага в большинстве случаев.
const PAGES = [
  'Главная', 'Каталог', 'Поиск', 'Закладки', 'Расписание', 'Галерея',
  'Ачивки', 'Дневник', 'Выбери за меня', 'Профиль', 'Настройки',
  'Плеер', 'Страница тайтла', 'Приложение (Android)', 'Другое',
]

/**
 * Заявки не копятся нигде на сервере — уходят прямо в Telegram Denanz тем же
 * ботом, что и остальные уведомления (см. notifier.ts на бэкенде).
 */
export default function FeedbackForm() {
  const modern = useDesign() === 'modern'
  const [type, setType] = useState<'bug' | 'idea'>('bug')
  const [page, setPage] = useState(PAGES[0])
  const [pageOpen, setPageOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!message.trim() || busy) return
    setBusy(true)
    // У идеи «страница» не имеет смысла — она не привязана к тому, что сейчас на экране.
    const ok = await sendFeedback(type, message.trim(), type === 'bug' ? page : undefined)
    setBusy(false)
    if (ok) {
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    }
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">Предложить / сообщить о баге</h2>
      <p className="text-xs text-muted mt-0.5 mb-3">
        Сообщение уйдёт напрямую разработчику.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setType('bug')}
          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
            type === 'bug' ? 'bg-accent text-black' : 'bg-white/[0.06] text-muted hover:text-text'
          }`}
        >
          🐞 Баг
        </button>
        <button
          onClick={() => { setType('idea'); setPageOpen(false) }}
          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
            type === 'idea' ? 'bg-accent text-black' : 'bg-white/[0.06] text-muted hover:text-text'
          }`}
        >
          💡 Идея
        </button>
      </div>

      {type === 'bug' && (
        <div className="relative mb-2">
          <button
            type="button"
            onClick={() => setPageOpen((v) => !v)}
            className="input w-full text-sm text-left flex items-center justify-between"
          >
            <span>{page}</span>
            <span className={`text-[10px] opacity-70 transition-transform ${pageOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {pageOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPageOpen(false)} />
              <div className="absolute left-0 right-0 mt-1.5 z-50 max-h-56 overflow-y-auto p-1.5
                              rounded-xl bg-elevated border border-white/10 shadow-2xl">
                {PAGES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPage(p); setPageOpen(false) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      page === p ? 'bg-accent/[0.12] text-accent' : 'text-muted hover:text-text hover:bg-white/[0.04]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={type === 'bug' ? 'Что именно сломалось?' : 'Что бы вы хотели видеть?'}
        rows={3}
        maxLength={2000}
        className="input w-full text-sm resize-none"
      />

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={submit}
          disabled={busy || !message.trim()}
          className="btn-primary !py-2 text-sm"
        >
          {busy ? '…' : 'Отправить'}
        </button>
        {sent && <span className="text-xs text-accent">Отправлено, спасибо!</span>}
      </div>
    </div>
  )
}
