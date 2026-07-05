import { useRef, useState } from 'react'
import { exportLists, importLists, toCsv, download, type BackupItem } from '../api/listsBackup'
import { useDesign } from '../lib/design'

export default function ListBackup() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const modern = useDesign() === 'modern'

  const doExport = async (fmt: 'json' | 'csv') => {
    setBusy(true); setStatus('Собираю списки…')
    try {
      const items = await exportLists(s => setStatus(s))
      const ts = new Date().toISOString().slice(0, 10)
      if (fmt === 'json') download(`miraihub-lists-${ts}.json`, JSON.stringify(items, null, 2))
      else download(`miraihub-lists-${ts}.csv`, toCsv(items), 'text/csv')
      setStatus(`Готово: ${items.length} тайтлов`)
    } catch { setStatus('Ошибка экспорта') }
    finally { setBusy(false) }
  }

  const doImport = async (file: File) => {
    setBusy(true); setStatus('Читаю файл…')
    try {
      const items = JSON.parse(await file.text()) as BackupItem[]
      if (!Array.isArray(items)) throw new Error('bad')
      if (!confirm(`Импортировать ${items.length} тайтлов в твои списки? Текущие статусы будут перезаписаны для совпадающих релизов.`)) {
        setBusy(false); setStatus(''); return
      }
      const ok = await importLists(items, (d, t) => setStatus(`Импорт: ${d} / ${t}`))
      setStatus(`Импортировано: ${ok} из ${items.length}`)
    } catch { setStatus('Неверный файл (нужен JSON-экспорт)') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold mb-1">Импорт / экспорт списков</h2>
      <p className="text-xs text-muted mb-4">Бэкап твоих списков (Смотрю / В планах / Просмотрено / Отложено / Брошено) в файл и восстановление.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => doExport('json')} disabled={busy} className="btn-ghost">⬇ Экспорт JSON</button>
        <button onClick={() => doExport('csv')} disabled={busy} className="btn-ghost">⬇ Экспорт CSV</button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost">⬆ Импорт JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f) }} />
        {status && <span className="text-xs text-muted">{status}</span>}
      </div>
    </div>
  )
}
