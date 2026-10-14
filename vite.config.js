import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'PWAACTIVATOR'],
  server:{
    fs: {
      deny: ['.env', '.env.*', 'env', '*.{crt,pem}', '**/.git/**', '**/vendor/**', '**/tmp/**']
    },
    proxy: {
      '/api': {
        target: process.env.IPAWCUS_SANDBOX === '1' ? 'http://127.0.0.1:8018' : 'http://localhost:8000',
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
