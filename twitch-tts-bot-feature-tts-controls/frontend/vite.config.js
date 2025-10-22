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
        manualChunks: {
          // Vendor chunks - библиотеки
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'sonner'],
          
          // Context - все контексты в отдельный чанк
          'contexts': [
            './src/context/AuthContext.jsx',
            './src/context/DataContext.jsx',
            './src/context/IntegrationsContext.jsx',
            './src/context/TtsContext.jsx',
            './src/context/TtsHealthContext.jsx',
            './src/context/PlayerContext.jsx',
            './src/context/ChatContext.jsx',
            './src/context/ActiveChannelsContext.jsx',
            './src/context/TtsCardContext.jsx',
            './src/context/DonationAlertsContext.jsx'
          ],
          
          // UI components
          'ui-components': [
            './src/components/ui/button.jsx',
            './src/components/ui/card.jsx',
            './src/components/ui/input.jsx',
            './src/components/ui/badge.jsx',
            './src/components/ui/select.jsx',
            './src/components/ui/switch.jsx',
            './src/components/ui/slider.jsx',
            './src/components/ui/dialog.jsx',
            './src/components/ui/toast.jsx',
            './src/components/ui/tabs.jsx',
            './src/components/ui/checkbox.jsx',
            './src/components/ui/separator.jsx',
            './src/components/ui/label.jsx',
            './src/components/ui/textarea.jsx',
            './src/components/ui/alert.jsx',
            './src/components/ui/popover.jsx',
            './src/components/ui/dropdown-menu.jsx'
          ],
          
          // Admin pages отдельно (используются редко)
          'admin': [
            './src/pages/AdminPage.jsx',
            './src/pages/admin/SessionManagementPage.jsx',
            './src/pages/admin/UserManagementPage.jsx',
            './src/pages/admin/MonitoringPage.jsx',
            './src/pages/admin/BotManagementPage.jsx',
            './src/pages/admin/SupportTicketsPage.jsx',
            './src/pages/admin/BlockedChannelsPage.jsx'
          ]
        }
      }
    },
    // Увеличиваем лимит предупреждения до 1000 KB (было 500 KB)
    chunkSizeWarningLimit: 1000,
    
    // Минификация (esbuild быстрее чем terser)
    minify: 'esbuild',
    
    // Удаляем console и debugger в продакшене
    esbuild: {
      drop: ['console', 'debugger']
    }
  }
})
