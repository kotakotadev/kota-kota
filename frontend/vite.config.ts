import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020'
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
