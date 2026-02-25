import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // needed for Docker port binding
    proxy: {
      // In Docker dev mode VITE_API_HOST points to the backend service name.
      // Locally it falls back to http://localhost:3001.
      '/api': process.env.VITE_API_HOST || 'http://localhost:3001',
    },
  },
})
