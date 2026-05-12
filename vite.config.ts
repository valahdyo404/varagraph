import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiBaseUrl = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8082'

export default defineConfig({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
  },
  plugins: [react(), tailwindcss()],
})
