import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import './index.css'

import App from './App.jsx'
import AppMotionSystem from './components/shared/AppMotionSystem.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import ThemedMantineProvider from './context/ThemedMantineProvider.jsx'
import { ensurePwaHeadTags, initializePwaInstallPromptCapture } from './pwa/pwaConfig.js'
import { registerPwaServiceWorker } from './pwa/registerPwaServiceWorker.js'

ensurePwaHeadTags()
initializePwaInstallPromptCapture()
registerPwaServiceWorker().catch((error) => {
  console.error('[iPawcus push] PWA service worker setup failed.', error)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedMantineProvider>
        <AppMotionSystem>
          <App />
        </AppMotionSystem>
      </ThemedMantineProvider>
    </ThemeProvider>
  </StrictMode>,
)
