// Доводит dist-tizen/ до вида Tizen-виджета: config.xml и иконка в корне, без PWA-файлов.
import { copyFileSync, rmSync } from 'node:fs'

const out = new URL('../dist-tizen/', import.meta.url)
copyFileSync(new URL('./config.xml', import.meta.url), new URL('config.xml', out))
copyFileSync(new URL('./icon.png', import.meta.url), new URL('icon.png', out))
for (const f of ['sw.js', 'manifest.webmanifest']) rmSync(new URL(f, out), { force: true })
console.log('dist-tizen/ готов к упаковке: npm run package:tizen')
