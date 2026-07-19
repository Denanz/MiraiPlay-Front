import { Link } from 'react-router-dom'
import { CHANGELOG } from '../lib/changelog'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
function fmtDate(iso?: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="text-muted hover:text-text text-xl leading-none" aria-label="Назад">←</Link>
        <h1 className="text-xl font-bold">История изменений</h1>
      </div>

      <ol className="relative border-l border-white/[0.08] ml-2 space-y-7">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.version} className="relative pl-6">
            {/* timeline dot */}
            <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 ${
              i === 0 ? 'bg-accent border-accent' : 'bg-bg border-white/20'
            }`} />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">v{entry.version}</span>
              {i === 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent/[0.15] text-accent border border-accent/30">
                  текущая
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                entry.kind === 'feature'
                  ? 'bg-white/[0.06] text-accent-soft'
                  : 'bg-white/[0.04] text-muted'
              }`}>
                {entry.kind === 'feature' ? 'новое' : 'исправления'}
              </span>
              {entry.date && <span className="text-xs text-muted ml-auto">{fmtDate(entry.date)}</span>}
            </div>

            {entry.intro && (
              <p className="mt-2 text-sm text-text/75 leading-relaxed">{entry.intro}</p>
            )}

            <ul className="mt-2.5 space-y-1.5">
              {entry.changes.map((c, j) => (
                <li key={j} className="flex gap-2 text-sm text-text/85 leading-relaxed">
                  <span className="text-accent/60 shrink-0">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
