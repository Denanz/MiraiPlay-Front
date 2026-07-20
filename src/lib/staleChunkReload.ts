// Восстановление после выката, случившегося при открытой вкладке.
//
// Страницы грузятся лениво, а Vite подмешивает в имена чанков хеш содержимого.
// После деплоя имена меняются, старые файлы удаляются с сервера — и вкладка,
// которая держит прежний index.html, при переходе на новую страницу просит
// файл, которого больше нет: «Failed to fetch dynamically imported module».
//
// Лечится перезагрузкой: она подтягивает свежий index.html с правильными
// именами. Делаем это сами, вместо того чтобы показывать ошибку.

const FLAG = 'miraihub_chunk_reloaded_at'
/** Защита от петли: если перезагрузка не помогла, второй раз за минуту не пробуем. */
const COOLDOWN_MS = 60_000

function reloadOnce(): void {
  let last = 0
  try { last = Number(sessionStorage.getItem(FLAG) || 0) } catch { /* приватный режим */ }
  if (Date.now() - last < COOLDOWN_MS) return // уже пробовали, дальше не мучаем
  try { sessionStorage.setItem(FLAG, String(Date.now())) } catch { /* не критично */ }
  window.location.reload()
}

function looksLikeStaleChunk(message: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) // Safari
  )
}

export function installStaleChunkReload(): void {
  // Vite сообщает об этом отдельным событием — самый надёжный сигнал.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault() // иначе всплывёт как необработанная ошибка
    reloadOnce()
  })

  // Запасной путь: то же самое, но пойманное как обычная ошибка загрузки.
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason as Error)?.message ?? e.reason ?? '')
    if (looksLikeStaleChunk(msg)) reloadOnce()
  })
}
