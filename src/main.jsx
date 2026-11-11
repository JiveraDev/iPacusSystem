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
import ErrorBoundary from './components/shared/ErrorBoundary.jsx'
import { ensurePwaHeadTags, initializePwaInstallPromptCapture } from './pwa/pwaConfig.js'
import { registerPwaServiceWorker } from './pwa/registerPwaServiceWorker.js'

try { applyTheme(getStoredTheme()) } catch { /* The provider can still render using its defaults. */ }
try {
  ensurePwaHeadTags()
  initializePwaInstallPromptCapture()
  registerPwaServiceWorker().catch(() => console.warn('[iPawcus] Service worker setup is unavailable.'))
} catch { console.warn('[iPawcus] Installation features are unavailable.') }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary root scope="application">
    <ThemeProvider>
      <ThemedMantineProvider>
        <AppMotionSystem>
          <App />
          <ErrorBoundary title="Document preview could not be displayed" scope="document-preview"><ProtectedDocumentPreview /></ErrorBoundary>
        </AppMotionSystem>
      </ThemedMantineProvider>
    </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
