import { useSyncExternalStore } from 'react'

export type DesignMode = 'legacy' | 'modern'

const KEY = 'miraihub_design'

function read(): DesignMode {
  try {
    return (localStorage.getItem(KEY) as DesignMode) === 'modern' ? 'modern' : 'legacy'
  } catch {
    return 'legacy'
  }
}

let mode: DesignMode = read()
const subs = new Set<() => void>()

export function getDesign(): DesignMode {
  return mode
}

export function setDesign(next: DesignMode): void {
  mode = next
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  document.documentElement.setAttribute('data-design', next)
  subs.forEach((f) => f())
}

// Реактивный хук: компоненты перерисовываются при смене дизайна.
export function useDesign(): DesignMode {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb) },
    () => mode,
    () => 'legacy',
  )
}
