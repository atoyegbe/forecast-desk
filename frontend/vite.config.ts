import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  envPrefix: 'QUORUM_PUBLIC_',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
