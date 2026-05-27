import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'https://thirdlevel-file-api.onrender.com'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/insighted-third-level-officials/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/insighted-third-level-officials/, '')
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        }
      }
    },
    base: '/insighted-third-level-officials/'
  }
})
