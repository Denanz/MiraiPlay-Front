import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tizenCssCompat from './tizen/postcss-compat.js'

// Телевизоры Samsung 2019 года (Tizen 5.0) крутят веб-приложения на Chromium 63.
const TIZEN_BROWSERS = ['chrome >= 63']

// index.html под Tizen: ранний скрипт совместимости первым в <head>, без PWA-манифеста.
function tizenHtml(): Plugin[] {
  return [
    {
      name: 'tizen-html',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const early = readFileSync(new URL('./tizen/early.js', import.meta.url), 'utf8')
          return html
            .replace(/<link rel="manifest"[^>]*>\s*/, '')
            .replace('<head>', `<head>\n    <script>${early}</script>`)
        },
      },
    },
    {
      // Скрипты с crossorigin на file:// грузятся в CORS-режиме и могут не загрузиться.
      name: 'tizen-html-no-crossorigin',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler: (html) => html.replace(/<script crossorigin /g, '<script '),
      },
    },
  ]
}

export default defineConfig(({ mode }) => {
  if (mode !== 'tizen') return { plugins: [react()] }

  // Сборка под Tizen: приложение открывается с file://, поэтому пути
  // относительные, ES-модули не годятся (file:// их не грузит) — плагин legacy
  // собирает всё в SystemJS-чанки с полифилами core-js.
  return {
    base: './',
    plugins: [
      react(),
      tizenHtml(),
      legacy({
        targets: TIZEN_BROWSERS,
        renderModernChunks: false,
      }),
    ],
    css: {
      postcss: {
        plugins: [
          tailwindcss(),
          tizenCssCompat(),
          autoprefixer({ overrideBrowserslist: TIZEN_BROWSERS }),
        ],
      },
    },
    build: {
      outDir: 'dist-tizen',
      emptyOutDir: true,
      // Относительный import.meta.url для SystemJS не нужен, а лишний inline-скрипт
      // с проверкой модулей только мешает.
      modulePreload: false,
    },
  }
})
