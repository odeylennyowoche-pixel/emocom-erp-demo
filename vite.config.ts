import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the built site works from any folder or GitHub Pages sub-path.
  base: './',
  // Fixed port so the demo URL is always the same (5173 is often used by other projects).
  server: { port: 5180, strictPort: true },
  preview: { port: 4180 },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
