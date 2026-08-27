// Каталог ачивок и движок их подсчёта.
// Общие вехи генерируются ступенями, привязанные к тайтлу сверяются по названию
// и требуют дойти до нужной серии.

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'story' | 'fun'

export interface AchContext {
  episodes: number
  minutes: number
  completed: number
  watching: number
  plan: number
  dropped: number
  holdOn: number
  favorite: number
  ratings: number
  comments: number
  collections: number
  videos: number
  friends: number
  registerYears: number
  genres: { name: string; percentage: number }[]
  watched: { releaseId: string; title: string; position: number }[]
}

export interface Achievement {
  id: string
  title: string
  desc: string
  icon: string
  category: string
  tier: Tier
  check: (c: AchContext) => { unlocked: boolean; progress: number; target: number }
}

export interface EvaluatedAchievement extends Achievement {
  unlocked: boolean
  progress: number
  target: number
  pct: number
}

const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

export const TIER_STYLE: Record<Tier, { ring: string; text: string; label: string }> = {
  bronze: { ring: 'ring-amber-700/50', text: 'text-amber-600', label: 'Бронза' },
  silver: { ring: 'ring-slate-400/50', text: 'text-slate-300', label: 'Серебро' },
  gold: { ring: 'ring-yellow-500/50', text: 'text-yellow-400', label: 'Золото' },
  platinum: { ring: 'ring-cyan-300/50', text: 'text-cyan-300', label: 'Платина' },
  diamond: { ring: 'ring-fuchsia-400/60', text: 'text-fuchsia-300', label: 'Алмаз' },
  story: { ring: 'ring-accent/60', text: 'text-accent', label: 'Сюжет' },
  fun: { ring: 'ring-pink-400/50', text: 'text-pink-300', label: 'Особое' },
}

// Ступенчатые вехи для числового показателя.
function milestones(
  idBase: string, category: string, icon: string,
  value: (c: AchContext) => number,
  steps: Array<{ n: number; title: string; desc: string }>,
): Achievement[] {
  return steps.map((s, i) => ({
    id: `${idBase}-${s.n}`,
    title: s.title,
    desc: s.desc,
    icon,
    category,
    tier: TIERS[Math.min(i, TIERS.length - 1)],
    check: (c: AchContext) => {
      const v = value(c)
      // Почти все показатели целые, но registerYears дробный: округляем вниз,
      // иначе прогресс покажет «n/n» у ещё не полученной ачивки.
      return { unlocked: v >= s.n, progress: Math.min(Math.floor(v), s.n), target: s.n }
    },
  }))
}

const norm = (s: string) => s.toLowerCase().replace(/[ё]/g, 'е').replace(/[^a-zа-я0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim()

// Веха по конкретному тайтлу: дойти до нужной серии, релиз ищется по названию.
function animeMilestone(
  id: string, icon: string, title: string, desc: string,
  match: string[], episode: number, tier: Tier = 'story',
): Achievement {
  const m = match.map(norm)
  return {
    id, title, desc, icon, category: 'Аниме-вехи', tier,
    check: (c) => {
      let best = 0
      for (const w of c.watched) {
        const t = norm(w.title)
        if (m.some(x => t.includes(x))) best = Math.max(best, w.position)
      }
      return { unlocked: best >= episode, progress: Math.min(best, episode), target: episode }
    },
  }
}

// ── Общий каталог ──
const generic: Achievement[] = [
  ...milestones('eps', 'Просмотр', '📺', c => c.episodes, [
    { n: 10, title: 'Первые шаги', desc: 'Посмотри 10 серий' },
    { n: 50, title: 'Втягиваешься', desc: 'Посмотри 50 серий' },
    { n: 100, title: 'Сотня', desc: 'Посмотри 100 серий' },
    { n: 250, title: 'Завсегдатай', desc: 'Посмотри 250 серий' },
    { n: 500, title: 'Полтысячи', desc: 'Посмотри 500 серий' },
    { n: 1000, title: 'Тысячник', desc: 'Посмотри 1000 серий' },
    { n: 2500, title: 'Ветеран', desc: 'Посмотри 2500 серий' },
    { n: 5000, title: 'Легенда', desc: 'Посмотри 5000 серий' },
    { n: 10000, title: 'Небожитель', desc: 'Посмотри 10000 серий' },
  ]),
  ...milestones('time', 'Время', '⏳', c => c.minutes, [
    { n: 60, title: 'Час в эфире', desc: '1 час за просмотром' },
    { n: 600, title: 'Полдня', desc: '10 часов за просмотром' },
    { n: 3000, title: 'Двое суток', desc: '50 часов за просмотром' },
    { n: 6000, title: 'Сотня часов', desc: '100 часов за просмотром' },
    { n: 30000, title: 'Затворник', desc: '500 часов за просмотром' },
    { n: 60000, title: 'Тысяча часов', desc: '1000 часов за просмотром' },
    { n: 120000, title: 'Хикки-сэнсэй', desc: '2000 часов за просмотром' },
  ]),
  ...milestones('done', 'Коллекция', '✅', c => c.completed, [
    { n: 1, title: 'Первый финал', desc: 'Заверши 1 тайтл' },
    { n: 5, title: 'Пятёрка', desc: 'Заверши 5 тайтлов' },
    { n: 10, title: 'Десятка', desc: 'Заверши 10 тайтлов' },
    { n: 25, title: 'Знаток', desc: 'Заверши 25 тайтлов' },
    { n: 50, title: 'Коллекционер', desc: 'Заверши 50 тайтлов' },
    { n: 100, title: 'Сотня финалов', desc: 'Заверши 100 тайтлов' },
    { n: 200, title: 'Архивариус', desc: 'Заверши 200 тайтлов' },
    { n: 500, title: 'Энциклопедист', desc: 'Заверши 500 тайтлов' },
  ]),
  ...milestones('watching', 'Списки', '👀', c => c.watching, [
    { n: 3, title: 'Жонглёр', desc: 'Смотри 3 тайтла одновременно' },
    { n: 5, title: 'Многозадачность', desc: 'Смотри 5 тайтлов одновременно' },
    { n: 10, title: 'Параллельщик', desc: 'Смотри 10 тайтлов одновременно' },
    { n: 20, title: 'Хаос', desc: 'Смотри 20 тайтлов одновременно' },
  ]),
  ...milestones('plan', 'Списки', '📌', c => c.plan, [
    { n: 10, title: 'Планов громадьё', desc: '10 тайтлов в планах' },
    { n: 25, title: 'Бэклог растёт', desc: '25 тайтлов в планах' },
    { n: 50, title: 'Когда-нибудь', desc: '50 тайтлов в планах' },
    { n: 100, title: 'Список мечты', desc: '100 тайтлов в планах' },
    { n: 250, title: 'Бездонный бэклог', desc: '250 тайтлов в планах' },
  ]),
  ...milestones('fav', 'Списки', '⭐', c => c.favorite, [
    { n: 1, title: 'Любимчик', desc: '1 тайтл в избранном' },
    { n: 5, title: 'Сердечки', desc: '5 тайтлов в избранном' },
    { n: 10, title: 'Топ-десятка', desc: '10 тайтлов в избранном' },
    { n: 25, title: 'Фаворитов не счесть', desc: '25 тайтлов в избранном' },
  ]),
  ...milestones('rate', 'Оценки', '🌟', c => c.ratings, [
    { n: 1, title: 'Первая оценка', desc: 'Поставь 1 оценку' },
    { n: 10, title: 'Критик', desc: 'Поставь 10 оценок' },
    { n: 50, title: 'Эксперт', desc: 'Поставь 50 оценок' },
    { n: 100, title: 'Жюри', desc: 'Поставь 100 оценок' },
    { n: 250, title: 'Верховный судья', desc: 'Поставь 250 оценок' },
  ]),
  ...milestones('comment', 'Активность', '💬', c => c.comments, [
    { n: 1, title: 'Голос подан', desc: 'Оставь 1 комментарий' },
    { n: 10, title: 'Болтун', desc: 'Оставь 10 комментариев' },
    { n: 50, title: 'Дискуссант', desc: 'Оставь 50 комментариев' },
    { n: 100, title: 'Глас народа', desc: 'Оставь 100 комментариев' },
  ]),
  ...milestones('coll', 'Активность', '📁', c => c.collections, [
    { n: 1, title: 'Куратор', desc: 'Создай 1 коллекцию' },
    { n: 5, title: 'Собиратель', desc: 'Создай 5 коллекций' },
    { n: 10, title: 'Музейщик', desc: 'Создай 10 коллекций' },
  ]),
  ...milestones('friends', 'Социальное', '🤝', c => c.friends, [
    { n: 1, title: 'Не один', desc: 'Заведи 1 друга' },
    { n: 5, title: 'Компания', desc: 'Заведи 5 друзей' },
    { n: 10, title: 'Тусовка', desc: 'Заведи 10 друзей' },
    { n: 25, title: 'Душа компании', desc: 'Заведи 25 друзей' },
  ]),
  ...milestones('age', 'Стаж', '🎂', c => c.registerYears, [
    { n: 1, title: 'Год с нами', desc: 'Аккаунту 1 год' },
    { n: 2, title: 'Олдфаг', desc: 'Аккаунту 2 года' },
    { n: 3, title: 'Старожил', desc: 'Аккаунту 3 года' },
    { n: 5, title: 'Динозавр', desc: 'Аккаунту 5 лет' },
  ]),
  // Шуточные и поведенческие
  {
    id: 'dropped-5', title: 'Не зашло', desc: 'Брось 5 тайтлов', icon: '🗑️', category: 'Особое', tier: 'fun',
    check: c => ({ unlocked: c.dropped >= 5, progress: Math.min(c.dropped, 5), target: 5 }),
  },
  {
    id: 'dropped-25', title: 'Беспощадный', desc: 'Брось 25 тайтлов', icon: '💀', category: 'Особое', tier: 'fun',
    check: c => ({ unlocked: c.dropped >= 25, progress: Math.min(c.dropped, 25), target: 25 }),
  },
  {
    id: 'holdon-10', title: 'На потом', desc: '10 тайтлов отложено', icon: '⏸️', category: 'Особое', tier: 'fun',
    check: c => ({ unlocked: c.holdOn >= 10, progress: Math.min(c.holdOn, 10), target: 10 }),
  },
  {
    id: 'taste-diverse', title: 'Всеяден', desc: 'Смотри 6+ разных жанров', icon: '🌈', category: 'Вкус', tier: 'gold',
    check: c => ({ unlocked: c.genres.length >= 6, progress: Math.min(c.genres.length, 6), target: 6 }),
  },
  {
    id: 'taste-focused', title: 'Свой жанр', desc: 'Один жанр — более 40% просмотра', icon: '🎯', category: 'Вкус', tier: 'silver',
    check: c => {
      // Округляем один раз и сравниваем то же значение, что показываем: иначе
      // при 39.6 прогресс нарисует «40/40» у неполученной ачивки.
      const top = Math.round(c.genres[0]?.percentage ?? 0)
      return { unlocked: top >= 40, progress: Math.min(top, 40), target: 40 }
    },
  },
]

// Жанровые ачивки: выдаются, если жанр попал в любимые.
const GENRE_FANS: Array<{ key: string; title: string; icon: string }> = [
  { key: 'экшен', title: 'Фанат экшена', icon: '💥' },
  { key: 'романтика', title: 'Романтик', icon: '💘' },
  { key: 'комедия', title: 'Любитель комедий', icon: '😂' },
  { key: 'драма', title: 'Ценитель драмы', icon: '🎭' },
  { key: 'фэнтези', title: 'Маг фэнтези', icon: '🐉' },
  { key: 'фантастика', title: 'Сай-фай гик', icon: '🚀' },
  { key: 'ужас', title: 'Не боится ужасов', icon: '👻' },
  { key: 'детектив', title: 'Сыщик', icon: '🔍' },
  { key: 'спорт', title: 'Спортивный дух', icon: '⚽' },
  { key: 'психолог', title: 'Психолог', icon: '🧠' },
  { key: 'меха', title: 'Пилот мехи', icon: '🤖' },
  { key: 'этти', title: 'Ну ты понял', icon: '😳' },
]
const genreFans: Achievement[] = GENRE_FANS.map(g => ({
  id: `genre-${g.key}`,
  title: g.title,
  desc: `«${g.title.split(' ').slice(-1)}» в твоих любимых жанрах`,
  icon: g.icon,
  category: 'Вкус',
  tier: 'silver' as Tier,
  check: (c: AchContext) => {
    const hit = c.genres.find(x => norm(x.name).includes(g.key))
    return { unlocked: !!hit, progress: hit ? 1 : 0, target: 1 }
  },
}))

// ── Вехи по конкретным тайтлам ──
const animeSpecific: Achievement[] = [
  animeMilestone('op-100', '🏴‍☠️', 'Гранд Лайн открыт', 'One Piece — 100 серий', ['one piece', 'ван пис', 'ванпис'], 100),
  animeMilestone('op-300', '🏴‍☠️', 'В Энис Лобби', 'One Piece — 300 серий', ['one piece', 'ван пис', 'ванпис'], 300),
  animeMilestone('op-500', '🏴‍☠️', 'Война у Маринфорда', 'One Piece — 500 серий', ['one piece', 'ван пис', 'ванпис'], 500, 'gold'),
  animeMilestone('op-700', '🏴‍☠️', 'Дресс-роза', 'One Piece — 700 серий', ['one piece', 'ван пис', 'ванпис'], 700, 'gold'),
  animeMilestone('op-900', '🏴‍☠️', 'Страна Вано', 'One Piece — 900 серий', ['one piece', 'ван пис', 'ванпис'], 900, 'platinum'),
  animeMilestone('op-1000', '👑', 'Король пиратов', 'One Piece — 1000 серий!', ['one piece', 'ван пис', 'ванпис'], 1000, 'diamond'),
  animeMilestone('naruto-220', '🍥', 'Наруто пройден', 'Наруто (ориг.) — 220 серий', ['наруто'], 220, 'gold'),
  animeMilestone('shippuden-500', '🌀', 'Конец Шиппудена', 'Наруто: Ураганные хроники — 500', ['ураганные хроники', 'shippuuden', 'shippuden', 'шипуден'], 500, 'platinum'),
  animeMilestone('bleach-366', '⚔️', 'Блич завершён', 'Bleach — 366 серий', ['bleach', 'блич'], 366, 'gold'),
  animeMilestone('conan-1000', '🕵️', 'Великий детектив', 'Детектив Конан — 1000 серий', ['конан', 'conan'], 1000, 'diamond'),
  animeMilestone('dbz-291', '🐉', 'Жемчуг собран', 'Dragon Ball Z — 291 серия', ['жемчуг дракона', 'dragon ball z', 'драгонбол'], 291, 'gold'),
  animeMilestone('gintama-265', '🍡', 'Йорозуя навсегда', 'Гинтама — 265 серий', ['гинтама', 'gintama'], 265, 'gold'),
  animeMilestone('fairy-175', '🧚', 'Хвост феи', 'Fairy Tail — 175 серий', ['хвост феи', 'fairy tail'], 175, 'silver'),
  animeMilestone('hxh-148', '🃏', 'Охота завершена', 'Hunter×Hunter — 148 серий', ['хантер', 'hunter x hunter', 'охотник х охотник'], 148, 'gold'),
  animeMilestone('boruto-200', '🌪️', 'Новое поколение', 'Боруто — 200 серий', ['боруто', 'boruto'], 200, 'silver'),
  animeMilestone('aot-25', '⚔️', 'За стенами', 'Атака титанов — 1 сезон', ['атака титанов', 'attack on titan', 'shingeki'], 25),
  animeMilestone('death-37', '📓', 'Кира пойман', 'Тетрадь смерти — финал', ['тетрадь смерти', 'death note'], 37, 'silver'),
  animeMilestone('fmab-64', '⚗️', 'Эквивалентный обмен', 'Стальной алхимик: Brotherhood — 64', ['стальной алхимик', 'fullmetal'], 64, 'gold'),
  animeMilestone('demon-26', '🗡️', 'Дыхание воды', 'Клинок демонов — 1 сезон', ['клинок', 'истребитель демонов', 'demon slayer', 'kimetsu'], 26),
  animeMilestone('jjk-24', '👊', 'Проклятая энергия', 'Магическая битва — 1 сезон', ['магическая битва', 'jujutsu'], 24),
  animeMilestone('codegeass-25', '♟️', 'Ваше высочество', 'Code Geass — 1 сезон', ['код гиас', 'code geass'], 25),
  animeMilestone('steins-24', '🥤', 'El Psy Congroo', 'Steins;Gate — финал', ['врата штейна', 'steins'], 24, 'silver'),
  animeMilestone('opm-12', '👊', 'Один удар', 'Ванпанчмен — 1 сезон', ['ванпанчмен', 'one punch'], 12),
  animeMilestone('evangelion-26', '🤖', 'Поздравляю', 'Евангелион — 26 серий', ['евангелион', 'evangelion'], 26, 'silver'),
]

export const ACHIEVEMENTS: Achievement[] = [...generic, ...genreFans, ...animeSpecific]

export function evaluate(ctx: AchContext): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map(a => {
    const r = a.check(ctx)
    return { ...a, ...r, pct: r.target ? Math.min(100, Math.round((r.progress / r.target) * 100)) : 0 }
  })
}
