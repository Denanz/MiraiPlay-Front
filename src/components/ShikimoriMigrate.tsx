import { useEffect, useRef, useState } from 'react'
import {
  getShikiStatus,
  getMigrateStatus,
  startMigrate,
  shikiBackupUrl,
  getImportStatus,
  startImport,
  type MigrateJob,
  type ImportJob,
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
  const [imp, setImp] = useState<ImportJob | null>(null)
  // Направление выбирается осознанно: у кого-то полнее списки здесь, у кого-то
  // на Shikimori, и «правильного» ответа по умолчанию нет.
  const [dir, setDir] = useState<'out' | 'in'>('out')
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    getShikiStatus().then((s) => setConnected(s.connected))
    getMigrateStatus().then(setJob)
    getImportStatus().then(setImp)
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

  useEffect(() => {
    if (!imp?.running) return
    const t = window.setInterval(() => { getImportStatus().then(setImp) }, 3000)
    return () => window.clearInterval(t)
  }, [imp?.running])

  if (!connected) return null

  const run = async (dryRun: boolean) => {
    setMsg(''); setConfirming(false)
    if (dir === 'in') {
      const ok = await startImport(dryRun)
      if (!ok) { setMsg('Прогон уже идёт — дождитесь окончания.'); return }
      setImp(await getImportStatus())
      return
    }
    const ok = await startMigrate(dryRun)
    if (!ok) { setMsg('Прогон уже идёт — дождитесь окончания.'); return }
    setJob(await getMigrateStatus())
  }

  const rep = job?.report
  const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0

  return (
    <div className={modern ? 'mdk-glass mdk-pad' : 'panel p-5'}>
      <h2 className="text-base font-semibold">Перенос списков</h2>
      <p className="text-xs text-muted mt-0.5 mb-3">
        Выберите, какая сторона главнее. Данные с неё перезапишут другую.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setDir('out')}
          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
            dir === 'out' ? 'bg-accent text-black' : 'bg-white/[0.06] text-muted hover:text-text'
          }`}
        >
          MiraiPlay → Shikimori
        </button>
        <button
          onClick={() => setDir('in')}
          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
            dir === 'in' ? 'bg-accent text-black' : 'bg-white/[0.06] text-muted hover:text-text'
          }`}
        >
          Shikimori → MiraiPlay
        </button>
      </div>

      <p className="text-xs text-muted mb-4">
        {dir === 'out'
          ? 'Статусы, число просмотренных серий и оценки уедут в список на Shikimori.'
          : 'Статусы списков и оценки перенесутся сюда. Тайтлы сопоставляются по оригинальному названию; что не сошлось однозначно — попадёт в список для ручного разбора, а не будет угадано.'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <a href={shikiBackupUrl()} className="btn-ghost !py-2 text-sm" download>
          1. Скачать бэкап Shikimori
        </a>
        <button onClick={() => run(true)} disabled={job?.running || imp?.running} className="btn-ghost !py-2 text-sm">
          2. Проверить без записи
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={job?.running || imp?.running}
          className="btn-primary !py-2 text-sm"
        >
          3. Перенести
        </button>
      </div>

      {confirming && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/[0.06] p-3 mb-4">
          <p className="text-sm text-amber-200">
            {dir === 'out'
              ? 'Записи на Shikimori будут перезаписаны данными из MiraiPlay.'
              : 'Списки и оценки здесь будут перезаписаны данными с Shikimori.'}
            {' '}Отменить одной кнопкой нельзя — восстановить можно только из скачанного бэкапа.
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

      {imp?.running && (
        <div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>{imp.dryRun ? 'Проверка без записи' : 'Импортирую'}…</span>
            <span>{imp.done} из {imp.total}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-accent transition-all"
              style={{ width: `${imp.total ? Math.round((imp.done / imp.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {!imp?.running && imp?.report && dir === 'in' && (
        <div className="text-sm space-y-1 mb-3">
          <div className="text-muted text-xs mb-1">
            {imp.dryRun ? 'Результат проверки' : 'Импорт завершён'}
          </div>
          <div>Записей на Shikimori: <b>{imp.report.total}</b></div>
          <div>Сопоставлено: <b className="text-accent">{imp.report.matched}</b></div>
          {!imp.dryRun && <div>Применено: <b>{imp.report.applied}</b></div>}
          {imp.report.skipped.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">В ручной разбор: {imp.report.skipped.length}</summary>
              <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {imp.report.skipped.map((s, i) => (
                  <li key={i}>{s.shikiName} — {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {!job?.running && rep && dir === 'out' && (
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
