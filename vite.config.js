import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'PWAACTIVATOR'],
  server:{
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    },
    hmr:{overlay: false
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    }
  }

})
