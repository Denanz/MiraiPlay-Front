// Держим в синхроне со списком разрешённых хостов на бэкенде (kodik.ts + anilibria.ts).
// Наш плеер умеет резолвить ссылки Kodik и AniLibria («Liberty» в списке дублей);
// источники на прочих хостах (RuTube и т.п.) сервер отклонит как «invalid player
// url». Проверяем это ДО перехода в плеер, чтобы вместо сломанной страницы
// показать понятное сообщение или тихо откатиться к выбору другой озвучки.
const ALLOWED_HOSTS = new Set([
  'kodikplayer.com',
  'kodik.info',
  'kodik.biz',
  'kodik.cc',
  'kodikdb.com',
  'aniqit.com',
  'anixart.libria.fun',
])

export function isPlayableUrl(url: string): boolean {
  if (!url) return false
  try {
    const normalized = url.startsWith('//') ? `https:${url}` : url
    return ALLOWED_HOSTS.has(new URL(normalized).hostname)
  } catch {
    return false
  }
}
