import path from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // This will fail if the port is in use, rather than trying another one
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Automatic chunking is usually better for modern HTTP/2+
      }
    },
    // Оптимизация размера чанков
    chunkSizeWarningLimit: 1000,

    // Минификация (esbuild быстрее чем terser)
    minify: 'esbuild',

    // Увеличиваем производительность сборки
    target: 'esnext',
    cssCodeSplit: true,

    // Включаем source maps только для разработки
    sourcemap: false,

    // Оптимизация ассетов
    assetsInlineLimit: 4096, // Инлайним маленькие файлы

    // Дополнительная оптимизация
    reportCompressedSize: false, // Ускоряет сборку
  },

  // Оптимизация для разработки
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      '@tanstack/react-query'
    ],
    exclude: ['recharts'] // Исключаем тяжелые библиотеки из предварительной оптимизации
  }
})
