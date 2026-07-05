import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createTheme, MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import './index.css'

import App from './App.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'

const mantineTheme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <MantineProvider theme={mantineTheme} defaultColorScheme="light">
        <App />
      </MantineProvider>
    </ThemeProvider>
  </StrictMode>,
)
