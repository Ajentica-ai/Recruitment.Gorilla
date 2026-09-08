import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        target: 'http://localhost:5134',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5134',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
