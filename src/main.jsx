import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import './index.css'
import './styles/themeVariants.css'
import './styles/themeCompatibility.css'
import './styles/publicThemes.css'

import App from './App.jsx'
import AppMotionSystem from './components/shared/AppMotionSystem.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import { applyTheme, getStoredTheme } from './lib/theme.js'
import ThemedMantineProvider from './context/ThemedMantineProvider.jsx'
import ProtectedDocumentPreview from './components/shared/ProtectedDocumentPreview.jsx'
import { ensurePwaHeadTags, initializePwaInstallPromptCapture } from './pwa/pwaConfig.js'
import { registerPwaServiceWorker } from './pwa/registerPwaServiceWorker.js'

applyTheme(getStoredTheme())
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
          <ProtectedDocumentPreview />
        </AppMotionSystem>
      </ThemedMantineProvider>
    </ThemeProvider>
  </StrictMode>,
)
