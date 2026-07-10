import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/workout-programming-spa/' : '/',
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })),
    __APP_VERSION__: JSON.stringify('alpha-1.0.0'),
  },
  server: {
    headers: {}
  }
}))
