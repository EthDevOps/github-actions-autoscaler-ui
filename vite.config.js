import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8080,
    // Mirror the production same-origin setup: proxy /api to the orchestrator during
    // local dev. Override the target with VITE_DEV_API_TARGET.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'https://github-autoscaler.ethquokkaops.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
