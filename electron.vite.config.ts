import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron-store'],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
        },
      },
    },
  },
  renderer: {
    publicDir: resolve('public'),
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
})
