import path from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: [
    "VITE_APP_",
    "VITE_API_",
    "VITE_BOT_SERVICE_",
    "VITE_CHAT_",
    "VITE_DEFAULT_",
    "VITE_ENABLE_",
    "VITE_LOCAL_TTS_AGENT_",
    "VITE_SENTRY_",
    "VITE_TTS_",
    "VITE_WS_",
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:8000",
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
        // Automatic chunking is usually better for modern HTTP/2+.
      },
    },
    // Keep large media/player chunks from failing the release build.
    chunkSizeWarningLimit: 1000,
    // esbuild is faster than terser and enough for this Vite bundle.
    minify: "esbuild",
    // Modern target keeps bundle output smaller for current browsers.
    target: "esnext",
    cssCodeSplit: true,
    // Production images should not ship source maps by default.
    sourcemap: false,
    // Inline only small assets.
    assetsInlineLimit: 4096,
    // Avoid gzip/brotli size work during local Docker builds.
    reportCompressedSize: false,
  },
  // Pre-bundle common dependencies for faster local Vite startup.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "axios",
      "@tanstack/react-query",
    ],
    exclude: ["recharts"],
  },
})
