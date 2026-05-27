import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/insighted-third-level-officials/api': {
        target: 'http://localhost:3008',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/insighted-third-level-officials/, '')
      },
      '/api': {
        target: 'http://localhost:3008',
        changeOrigin: true,
      }
    }
  },
  base: '/insighted-third-level-officials/'
})
