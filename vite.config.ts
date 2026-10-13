import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// maplibre-gl は Web Worker を別ファイルとして配布し、
// 実行時に import.meta.url からの相対パスで読み込む。
// Vite のビルド成果物には自動で含まれないため、ここでコピーする。
const copyMaplibreWorker: Plugin = {
  name: 'copy-maplibre-worker',
  apply: 'build',
  closeBundle() {
    const outDir = resolve(process.cwd(), 'dist/assets')
    mkdirSync(outDir, { recursive: true })
    copyFileSync(
      resolve(process.cwd(), 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'),
      resolve(outDir, 'maplibre-gl-worker.mjs'),
    )
  },
}

export default defineConfig({
  // dev 時は maplibre-gl を事前バンドルしない。
  // 事前バンドルすると Worker の相対 URL が解決できず
  // "Worker failed to load" になる。
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  plugins: [copyMaplibreWorker],
})
