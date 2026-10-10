/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages serves /harmonylab/).
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  define: {
    // Shown in the engine details panel so a report can be matched to a build.
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)}`),
  },
  server: { host: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
