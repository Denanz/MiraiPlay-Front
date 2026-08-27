#!/usr/bin/env node
// Поднимает версию в build.gradle (versionCode всегда +1, versionName по правилу
// проекта: patch за исправления, minor за новое) и дописывает запись в changelog.ts.
//
// Запуск: node scripts/bump-version.mjs <patch|minor> "строка" ["ещё строка" ...]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [, , kind, ...rest] = process.argv
// Необязательное вступление: --intro "пара строк своими словами". Changelog
// читается как рассказ, а не как голый список, поэтому у новых версий тоже
// должно быть чем открыться.
let intro = ''
const notes = []
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--intro') { intro = rest[++i] ?? ''; continue }
  notes.push(rest[i])
}

if (!['patch', 'minor'].includes(kind)) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor> "changelog line" [...]')
  process.exit(1)
}
if (notes.length === 0) {
  console.error('Provide at least one changelog line as extra arguments.')
  process.exit(1)
}

const gradlePath = join(root, 'android/app/build.gradle')
let gradle = readFileSync(gradlePath, 'utf8')
const codeMatch = gradle.match(/versionCode (\d+)/)
const nameMatch = gradle.match(/versionName "([\d.]+)"/)
if (!codeMatch || !nameMatch) {
  console.error('Could not find versionCode/versionName in build.gradle')
  process.exit(1)
}

const nextCode = Number(codeMatch[1]) + 1
const parts = nameMatch[1].split('.').map(Number)
let nextName
if (kind === 'minor') {
  nextName = `${parts[0]}.${(parts[1] || 0) + 1}`
} else if (parts.length >= 3) {
  nextName = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
} else {
  nextName = `${parts[0]}.${parts[1]}.1`
}

gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${nextCode}`)
  .replace(/versionName "[\d.]+"/, `versionName "${nextName}"`)
writeFileSync(gradlePath, gradle)

const changelogPath = join(root, 'src/lib/changelog.ts')
let changelog = readFileSync(changelogPath, 'utf8')
// В одинарных кавычках, как и остальной файл.
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const entryLines = notes.map((n) => `      ${quote(n)},`).join('\n')
const introLine = intro ? `    intro: ${quote(intro)},\n` : ''
const entry =
  `  {\n    version: '${nextName}',\n` +
  `    kind: '${kind === 'minor' ? 'feature' : 'fix'}',\n${introLine}    changes: [\n${entryLines}\n    ],\n  },\n`

const marker = 'export const CHANGELOG: ChangelogEntry[] = [\n'
if (!changelog.includes(marker)) {
  console.error('Could not find CHANGELOG array start in changelog.ts')
  process.exit(1)
}
changelog = changelog.replace(marker, marker + entry)
writeFileSync(changelogPath, changelog)

// app-version.json — то, по чему приложение понимает, что вышло обновление
// (его отдаёт GET /api/v1/app/version). Раньше файл правился руками через
// docker cp, и про него легко было забыть: тогда пользователи сидели на старом
// APK и считали, что баг «на сайте». Здесь готовим содержимое, а сам docker cp
// в контейнер делает deploy.sh — /app/.state лежит в именованном томе, писать
// туда с хоста напрямую нельзя.
const appVersionPath = join(root, 'app-version.json')
let appVersion = { url: 'https://anime.denanz.fun/mirai.apk', mandatory: false }
try {
  // Сохраняем url/mandatory, если их правили вручную.
  appVersion = { ...appVersion, ...JSON.parse(readFileSync(appVersionPath, 'utf8')) }
} catch { /* файла ещё нет — берём значения по умолчанию */ }
appVersion.versionCode = nextCode
appVersion.versionName = nextName
appVersion.notes = notes.join(' ')
writeFileSync(appVersionPath, JSON.stringify(appVersion, null, 2) + '\n')

console.log(`Bumped to ${nextName} (versionCode ${nextCode}, ${kind})`)
console.log(`app-version.json готов — deploy.sh скопирует его в контейнер`)
