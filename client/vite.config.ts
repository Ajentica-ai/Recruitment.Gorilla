import { createReadStream, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5134'

/*
 * Browser OCR (#260) self-hosts Tesseract.js instead of pulling it from its default CDN: the worker script, the
 * LSTM-only wasm cores (Tesseract picks the SIMD variant the browser supports) and the English model. They are
 * served from node_modules in dev and copied into the build under a folder named after the package versions,
 * so an upgrade never meets a stale cached file. Only the files a browser fetches are copied (about 12 MB on
 * disk; one browser downloads about 7 MB once, then the model is cached in IndexedDB).
 */
const nodeModules = path.resolve(import.meta.dirname, 'node_modules')
const pkgVersion = (name: string): string =>
  JSON.parse(readFileSync(path.join(nodeModules, name, 'package.json'), 'utf8')).version
const ocrAssetDir = `tesseract/${pkgVersion('tesseract.js')}-${pkgVersion('tesseract.js-core')}-${pkgVersion('@tesseract.js-data/eng')}`
const ocrAssets: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}

function tesseractAssets(): Plugin {
  return {
    name: 'tesseract-assets',
    configureServer(server) {
      const prefix = `${server.config.base}${ocrAssetDir}/`
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const source = url.startsWith(prefix) ? ocrAssets[url.slice(prefix.length)] : undefined
        if (!source) return next()
        res.setHeader('Content-Type', url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        createReadStream(path.join(nodeModules, source)).pipe(res)
      })
    },
    generateBundle() {
      for (const [name, source] of Object.entries(ocrAssets)) {
        this.emitFile({ type: 'asset', fileName: `${ocrAssetDir}/${name}`, source: readFileSync(path.join(nodeModules, source)) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tesseractAssets()],
  // Where the self-hosted Tesseract.js files live, relative to the app base (see tesseractAssets above).
  define: { __OCR_ASSET_DIR__: JSON.stringify(ocrAssetDir) },
  resolve: {
    // Mirrors the "@/*" path in tsconfig.app.json.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // Local `npm run dev`/`preview` stay unprefixed ("/") since they bypass the
  // gateway and talk to the backend directly via the proxy below. The Docker
  // build sets VITE_BASE=/ats/ so the built bundle works behind the gateway,
  // which serves this app under that prefix (see Gorilla.Platform/deploy).
  base: process.env.VITE_BASE ?? '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    host: true, // expose the dev server on the LAN (other PCs reach the frontend)
    proxy: {
      // Browser calls same-origin /api; Vite forwards to the backend on this
      // host only, so the backend (port 5134) is never exposed to the network.
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/hubs': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
