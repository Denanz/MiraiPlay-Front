import { useEffect, useState } from 'react'
import {
  getStorageBreakdown, getSpotlightOverride, setSpotlightOverride, getTelemetry,
  banIp, unbanIp, banUser, unbanUser, downloadHubApk,
  type StorageBreakdown, type Telemetry,
} from '../api/admin'

const STORAGE_KEY = 'miraihub_admin_key'

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`
  const units = ['КБ', 'МБ', 'ГБ']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

function fmtUptime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

function fmtAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}

const ROWS: Array<{ key: keyof StorageBreakdown['breakdown']; label: string }> = [
  { key: 'screenshots', label: 'Скриншоты' },
  { key: 'progress', label: 'Прогресс просмотра' },
  { key: 'ratings', label: 'Оценки' },
  { key: 'diary', label: 'Дневник' },
  { key: 'cache', label: 'Кэш (Shikimori/img)' },
  { key: 'other', label: 'Прочее' },
]

export default function AdminPage() {
  const [keyInput, setKeyInput] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [data, setData] = useState<StorageBreakdown | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [spotlightId, setSpotlightId] = useState<string | null>(null)
  const [spotlightInput, setSpotlightInput] = useState('')
  const [spotlightSaving, setSpotlightSaving] = useState(false)

  const [ipInput, setIpInput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [denylistBusy, setDenylistBusy] = useState(false)

  const [hubApkBusy, setHubApkBusy] = useState(false)
  const [hubApkError, setHubApkError] = useState('')

  const fetchHubApk = async () => {
    setHubApkBusy(true)
    setHubApkError('')
    try {
      await downloadHubApk(adminKey)
    } catch {
      setHubApkError('Не удалось скачать APK')
    } finally {
      setHubApkBusy(false)
    }
  }

  const load = async (key: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await getStorageBreakdown(key)
      setData(result)
      setAdminKey(key)
      localStorage.setItem(STORAGE_KEY, key)
      getSpotlightOverride().then(setSpotlightId).catch(() => {})
      getTelemetry(key).then(setTelemetry).catch(() => {})
    } catch {
      setError('Неверный ключ или сервер недоступен')
      localStorage.removeItem(STORAGE_KEY)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) load(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSpotlight = async (releaseId: string | null) => {
    setSpotlightSaving(true)
    try {
      await setSpotlightOverride(adminKey, releaseId)
      setSpotlightId(releaseId)
      setSpotlightInput('')
    } catch {
      alert('Не удалось сохранить — проверь id релиза')
    } finally {
      setSpotlightSaving(false)
    }
  }

  const refreshTelemetry = () => getTelemetry(adminKey).then(setTelemetry).catch(() => {})

  const submitBanIp = async () => {
    if (!ipInput.trim()) return
    setDenylistBusy(true)
    try {
      await banIp(adminKey, ipInput.trim())
      setIpInput('')
      await refreshTelemetry()
    } catch {
      alert('Не удалось забанить IP (возможно, локальный/приватный адрес)')
    } finally {
      setDenylistBusy(false)
    }
  }

  const submitBanUser = async () => {
    if (!userInput.trim()) return
    setDenylistBusy(true)
    try {
      await banUser(adminKey, userInput.trim())
      setUserInput('')
      await refreshTelemetry()
    } catch {
      alert('Не удалось забанить пользователя')
    } finally {
      setDenylistBusy(false)
    }
  }

  const removeIpBan = async (ip: string) => {
    setDenylistBusy(true)
    try { await unbanIp(adminKey, ip); await refreshTelemetry() } finally { setDenylistBusy(false) }
  }

  const removeUserBan = async (value: string) => {
    setDenylistBusy(true)
    try { await unbanUser(adminKey, value); await refreshTelemetry() } finally { setDenylistBusy(false) }
  }

  if (!data) {
    return (
      <div className="max-w-sm mx-auto py-16">
        <h1 className="text-xl font-bold mb-4">Админ-панель</h1>
        <form onSubmit={e => { e.preventDefault(); load(keyInput) }} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Admin key"
            className="input"
          />
          <button type="submit" disabled={loading || !keyInput} className="btn-primary">
            {loading ? 'Проверяю…' : 'Войти'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    )
  }

  const { breakdown, totalBytes } = data
  const max = Math.max(...ROWS.map(r => breakdown[r.key].bytes), 1)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Админ-панель</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => load(adminKey)} disabled={loading} className="text-sm text-muted hover:text-text">
            {loading ? 'Обновляю…' : '↻ Обновить'}
          </button>
          <button
            onClick={() => { localStorage.removeItem(STORAGE_KEY); setData(null); setKeyInput('') }}
            className="text-sm text-muted hover:text-text"
          >
            Выйти
          </button>
        </div>
      </div>

      {telemetry && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Активность</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="panel p-4">
              <p className="text-xs text-muted mb-1">Аптайм</p>
              <p className="text-lg font-semibold">{fmtUptime(telemetry.overview.uptimeMs)}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-muted mb-1">Запросов/час</p>
              <p className="text-lg font-semibold">{telemetry.overview.lastHour}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-muted mb-1">Сессий</p>
              <p className="text-lg font-semibold">{telemetry.overview.sessionsSeen}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-muted mb-1">Онлайн (15 мин)</p>
              <p className="text-lg font-semibold">{telemetry.overview.active.length}</p>
            </div>
          </div>

          {telemetry.overview.active.length > 0 && (
            <div className="panel p-5 mb-4">
              <p className="text-sm font-semibold mb-3">Сейчас онлайн</p>
              <div className="flex flex-col gap-2">
                {telemetry.overview.active.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span>{s.login} <span className="text-muted">({s.id})</span></span>
                    <span className="text-muted">{s.ip} · {fmtAgo(s.seenAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel p-5 mb-6">
            <p className="text-sm font-semibold mb-3">Последние входы</p>
            <div className="flex flex-col gap-2.5">
              {telemetry.recentLogins.map((l, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{l.login} <span className="text-muted font-normal">({l.id})</span></span>
                    <span className="text-muted text-xs">{fmtAgo(l.at)}</span>
                  </div>
                  <p className="text-xs text-muted truncate">{l.ip} · {l.agent}</p>
                </div>
              ))}
              {telemetry.recentLogins.length === 0 && <p className="text-sm text-muted">—</p>}
            </div>
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Денилист</h2>
          <div className="panel p-5 mb-6 flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted mb-2">IP-адреса</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {telemetry.denylist.ips.map(ip => (
                  <span key={ip} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/[0.08] border border-red-500/20 text-xs">
                    {ip}
                    <button onClick={() => removeIpBan(ip)} disabled={denylistBusy} className="text-red-400 hover:text-red-300">✕</button>
                  </span>
                ))}
                {telemetry.denylist.ips.length === 0 && <span className="text-xs text-muted">пусто</span>}
              </div>
              <form onSubmit={e => { e.preventDefault(); submitBanIp() }} className="flex gap-2">
                <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="IP для бана" className="input !py-1.5 text-sm flex-1" />
                <button type="submit" disabled={denylistBusy || !ipInput.trim()} className="btn-ghost !py-1.5 !px-3 text-sm text-red-400">Забанить</button>
              </form>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Аккаунты (id или логин)</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {telemetry.denylist.accounts.map(id => (
                  <span key={`id-${id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/[0.08] border border-red-500/20 text-xs">
                    {id}
                    <button onClick={() => removeUserBan(String(id))} disabled={denylistBusy} className="text-red-400 hover:text-red-300">✕</button>
                  </span>
                ))}
                {telemetry.denylist.logins.map(login => (
                  <span key={`login-${login}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/[0.08] border border-red-500/20 text-xs">
                    {login}
                    <button onClick={() => removeUserBan(login)} disabled={denylistBusy} className="text-red-400 hover:text-red-300">✕</button>
                  </span>
                ))}
                {telemetry.denylist.accounts.length === 0 && telemetry.denylist.logins.length === 0 && (
                  <span className="text-xs text-muted">пусто</span>
                )}
              </div>
              <form onSubmit={e => { e.preventDefault(); submitBanUser() }} className="flex gap-2">
                <input value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="id или логин" className="input !py-1.5 text-sm flex-1" />
                <button type="submit" disabled={denylistBusy || !userInput.trim()} className="btn-ghost !py-1.5 !px-3 text-sm text-red-400">Забанить</button>
              </form>
            </div>
          </div>
        </>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Хаб</h2>
      <div className="panel p-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Приватное Android-приложение MiraiHub (mirai.denanz.fun) — только для тебя.</p>
          <button onClick={fetchHubApk} disabled={hubApkBusy} className="btn-ghost !py-1.5 !px-3 text-sm shrink-0">
            {hubApkBusy ? 'Скачиваю…' : '⬇ Скачать APK'}
          </button>
        </div>
        {hubApkError && <p className="text-sm text-red-400 mt-2">{hubApkError}</p>}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">«В центре внимания»</h2>
      <div className="panel p-5 mb-6">
        {spotlightId ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">Закреплён релиз <span className="font-semibold">#{spotlightId}</span></p>
            <button onClick={() => saveSpotlight(null)} disabled={spotlightSaving} className="btn-ghost !py-1.5 !px-3 text-sm">
              Вернуть авто-подбор
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mb-3">Сейчас показывается автоматический подбор по популярности. Можно закрепить конкретный тайтл вручную.</p>
            <form onSubmit={e => { e.preventDefault(); if (spotlightInput.trim()) saveSpotlight(spotlightInput.trim()) }} className="flex gap-2">
              <input
                value={spotlightInput}
                onChange={e => setSpotlightInput(e.target.value)}
                placeholder="id релиза (число из URL /release/<id>)"
                className="input !py-2 text-sm flex-1"
              />
              <button type="submit" disabled={spotlightSaving || !spotlightInput.trim()} className="btn-primary !py-2 !px-4 text-sm">
                Закрепить
              </button>
            </form>
          </>
        )}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Хранилище</h2>
      <div className="panel p-5 mb-4">
        <p className="text-sm text-muted mb-1">Всего занято</p>
        <p className="text-3xl font-bold">{fmtBytes(totalBytes)}</p>
      </div>

      <div className="panel p-5 flex flex-col gap-4">
        {ROWS.map(({ key, label }) => {
          const bytes = breakdown[key].bytes
          const pct = Math.round((bytes / max) * 100)
          const buckets = key === 'screenshots' ? breakdown.screenshots.buckets : undefined
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{label}{buckets != null && <span className="text-muted"> · {buckets} bucket(-ов)</span>}</span>
                <span className="text-muted">{fmtBytes(bytes)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
