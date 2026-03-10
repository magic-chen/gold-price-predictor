import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 生产环境部署在 /goldpredict/ 子路径下
const BASE_PATH = process.env.VITE_BASE_PATH || '/goldpredict/'

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
