import { useEffect, useRef, useState } from 'react'
import {
  getShikiStatus,
  getMigrateStatus,
  startMigrate,
  shikiBackupUrl,
  type MigrateJob,
} from '../api/notify'
import { useDesign } from '../lib/design'

/**
 * Перенос списков в Shikimori.
 *
 * Порядок намеренно жёсткий: сначала бэкап, потом холостой прогон, и только
 * потом запись. Операция массовая и правит живой аккаунт на стороннем сервисе,
 * поэтому «нажал и понеслось» здесь неуместно.
 */
export default function ShikimoriMigrate() {
  const modern = useDesign() === 'modern'
  const [connected, setConnected] = useState(false)
  const [job, setJob] = useState<MigrateJob | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    getShikiStatus().then((s) => setConnected(s.connected))
    getMigrateStatus().then(setJob)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [])

  // Пока прогон идёт, опрашиваем состояние: он длится минуты, держать
  // соединение всё это время нельзя.
  useEffect(() => {
    if (!job?.running) {
      if (timer.current) { window.clearInterval(timer.current); timer.current = null }
      return
    }
    timer.current = window.setInterval(() => { getMigrateStatus().then(setJob) }, 3000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [job?.running])

  if (!connected) return null

  const run = async (dryRun: boolean) => {
    setMsg(''); setConfirming(false)
    const ok = await startMigrate(dryRun)
    if (!ok) { setMsg('Прогон уже идёт — дождитесь окончания.'); return }
    const s = await getMigrateStatus()
    setJob(s)
  }

  const rep = job?.report
  const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">Перенос списков в Shikimori</h2>
      <p className="text-xs text-muted mt-0.5 mb-4">
        Статусы, число просмотренных серий и оценки уедут в список на Shikimori.
        Существующие записи там будут перезаписаны данными отсюда.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <a href={shikiBackupUrl()} className="btn-ghost !py-2 text-sm" download>
          1. Скачать бэкап Shikimori
        </a>
        <button onClick={() => run(true)} disabled={job?.running} className="btn-ghost !py-2 text-sm">
          2. Проверить без записи
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={job?.running}
          className="btn-primary !py-2 text-sm"
        >
          3. Перенести
        </button>
      </div>

      {confirming && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/[0.06] p-3 mb-4">
          <p className="text-sm text-amber-200">
            Записи на Shikimori будут перезаписаны данными из MiraiHub. Отменить это одной
            кнопкой нельзя — восстановить можно только из скачанного бэкапа.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => run(false)} className="btn-primary !py-1.5 text-sm">
              Да, перенести
            </button>
            <button onClick={() => setConfirming(false)} className="btn-ghost !py-1.5 text-sm">
              Отмена
            </button>
          </div>
        </div>
      )}

      {job?.running && (
        <div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>{job.dryRun ? 'Проверка без записи' : 'Переношу'}…</span>
            <span>{job.done} из {job.total}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">
            Идёт медленно намеренно: Shikimori ограничивает частоту запросов.
            Страницу можно закрыть, перенос продолжится.
          </p>
        </div>
      )}

      {!job?.running && rep && (
        <div className="text-sm space-y-1">
          <div className="text-muted text-xs mb-1">
            {job?.dryRun ? 'Результат проверки' : 'Перенос завершён'}
          </div>
          <div>Всего тайтлов: <b>{rep.total}</b></div>
          <div>Найдено на Shikimori: <b>{rep.matched}</b></div>
          {!job?.dryRun && <div>Записано: <b className="text-accent">{rep.written}</b></div>}
          {rep.unmatched.length > 0 && (
            <div className="text-muted">
              Не нашлось: {rep.unmatched.length} — {rep.unmatched.slice(0, 5).join(', ')}
              {rep.unmatched.length > 5 && '…'}
            </div>
          )}
          {rep.failed.length > 0 && (
            <div className="text-red-400">Ошибок записи: {rep.failed.length}</div>
          )}
        </div>
      )}

      {msg && <div className="text-xs text-muted mt-3">{msg}</div>}
    </div>
  )
}
