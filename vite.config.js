import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'PWAACTIVATOR'],
  server:{
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, '/php/index.php/api')
      }
    },
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
