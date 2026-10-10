/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages serves /harmonylab/).
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  server: { host: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
