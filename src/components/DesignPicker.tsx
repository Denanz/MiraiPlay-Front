import { useDesign, setDesign, type DesignMode } from '../lib/design'

const OPTIONS: { id: DesignMode; label: string; hint: string }[] = [
  { id: 'legacy', label: 'Legacy', hint: 'Классический вид — верхняя навигация' },
  { id: 'modern', label: 'Modern', hint: 'Боковой рейл, стекло, крупная типографика' },
]

export default function DesignPicker() {
  const mode = useDesign()
  return (
    <section className={mode === 'modern' ? 'mdk-glass mdk-pad' : 'panel p-5 sm:p-6'}>
      <h2 className="text-base font-semibold mb-1">Дизайн интерфейса</h2>
      <p className="text-xs text-muted mb-4">Переключение между двумя обликами приложения. Применяется сразу.</p>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => {
          const active = mode === o.id
          return (
            <button
              key={o.id}
              onClick={() => setDesign(o.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                active
                  ? 'border-accent/50 bg-accent/[0.10]'
                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${active ? 'text-accent' : ''}`}>{o.label}</span>
                {active && <span className="text-accent text-sm">✓</span>}
              </div>
              <p className="text-[11px] text-muted mt-1 leading-snug">{o.hint}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
