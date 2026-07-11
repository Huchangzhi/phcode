import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/run': {
        target: 'http://localhost:27120',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/run/, '/api/run'),
      },
      '/api': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
      '/easyrun': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
      '/easyrun_api': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
      '/debug': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
      '/companion': {
        target: 'http://localhost:27120',
        changeOrigin: true,
      },
    },
  },
})
