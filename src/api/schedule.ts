import { api } from './client'
import type { Release } from './releases'

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Weekday = typeof DAYS[number]

export const DAY_LABELS: Record<Weekday, string> = {
  monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг',
  friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье',
}

// getDay() в JS: 0 — воскресенье, 6 — суббота; переводим в наш ключ дня
export function todayKey(): Weekday {
  return (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as Weekday[])[new Date().getDay()]
}

export async function getSchedule(): Promise<Record<Weekday, Release[]>> {
  const res = await api.get<Record<string, unknown>>('/api/v1/schedule')
  const out = {} as Record<Weekday, Release[]>
  for (const d of DAYS) out[d] = (res.data?.[d] as Release[]) || []
  return out
}

// Сезоны Anixart: 1 — зима, 2 — весна, 3 — лето, 4 — осень
export const SEASONS: Array<{ id: number; label: string; emoji: string }> = [
  { id: 1, label: 'Зима', emoji: '❄️' },
  { id: 2, label: 'Весна', emoji: '🌸' },
  { id: 3, label: 'Лето', emoji: '☀️' },
  { id: 4, label: 'Осень', emoji: '🍂' },
]

export function currentSeason(): number {
  const m = new Date().getMonth() // 0..11
  if (m <= 1 || m === 11) return 1   // Dec, Jan, Feb
  if (m <= 4) return 2               // Mar–May
  if (m <= 7) return 3               // Jun–Aug
  return 4                           // Sep–Nov
}
