import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 2,
            },
            {
              name: 'three-vendor',
              test: /node_modules[\\/]three[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
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
