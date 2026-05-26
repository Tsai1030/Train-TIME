import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tdx-auth': {
        target: 'https://tdx.transportdata.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tdx-auth/, ''),
      },
      '/tdx': {
        target: 'https://tdx.transportdata.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tdx/, ''),
      },
    },
  },
})
