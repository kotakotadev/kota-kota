import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Fixed names so Worker SSR HTML can reference them without content-hash
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (info) => info.name?.endsWith('.css') ? 'assets/index.css' : 'assets/[name][extname]'
      }
    }
  },
  server: {
    proxy: {
      // /api/* → Worker dev server (no path rewrite since Worker routes are under /api/)
      '/api': 'http://localhost:8787'
    }
  }
})
