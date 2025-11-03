import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // This will fail if the port is in use, rather than trying another one
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - библиотеки разделены для параллельной загрузки
          if (id.includes('node_modules')) {
            // React core - критически важные
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // UI библиотеки
            if (id.includes('lucide-react')) {
              return 'ui-icons';
            }
            if (id.includes('sonner')) {
              return 'ui-toast';
            }
            // Radix UI компоненты - большие, выносим отдельно
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            // Тяжелые библиотеки
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('react-youtube')) {
              return 'youtube';
            }
            if (id.includes('axios')) {
              return 'http-client';
            }
            // Остальные vendor зависимости
            return 'vendor';
          }
          
          // Context chunks - разделяем для lazy loading
          if (id.includes('/context/')) {
            if (id.includes('AuthContext') || id.includes('IntegrationsContext')) {
              return 'contexts-core';
            }
            return 'contexts';
          }
          
          // UI components - один чанк для всех
          if (id.includes('/components/ui/')) {
            return 'ui-components';
          }
          
          // Admin pages отдельно (используются редко)
          if (id.includes('/pages/admin/')) {
            return 'admin';
          }
          
          // Drops pages отдельно
          if (id.includes('/pages/drops/') || id.includes('/pages/obs/')) {
            return 'drops';
          }
        }
      }
    },
    // Оптимизация размера чанков
    chunkSizeWarningLimit: 1000,
    
    // Минификация (esbuild быстрее чем terser)
    minify: 'esbuild',
    
    // Удаляем console и debugger в продакшене
    esbuild: {
      drop: ['console', 'debugger']
    },
    
    // Увеличиваем производительность сборки
    target: 'esnext',
    cssCodeSplit: true,
    
    // Включаем source maps только для разработки
    sourcemap: false,
    
    // Оптимизация ассетов
    assetsInlineLimit: 4096, // Инлайним маленькие файлы
  },
  
  // Оптимизация для разработки
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios'
    ],
    exclude: ['recharts'] // Исключаем тяжелые библиотеки из предварительной оптимизации
  }
})
