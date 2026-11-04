import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://127.0.0.1:5000'

  try {
    const target = new URL(backendTarget)
    if (!['http:', 'https:'].includes(target.protocol)) {
      throw new Error()
    }
  } catch {
    throw new Error('VITE_BACKEND_URL must be a valid HTTP or HTTPS URL.')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
