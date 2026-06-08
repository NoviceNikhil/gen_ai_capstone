import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
      // chatbot changes start
      "@schedully": path.resolve(process.cwd(), "../schedully/frontend"),
      // chatbot changes end
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/api': 'http://localhost:5000',
    },
  },
})

