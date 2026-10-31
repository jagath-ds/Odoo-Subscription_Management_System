import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { AppProvider } from '@/mocks/store/AppStore'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AppProvider>
        <BrowserRouter>
          <App />
          <Toaster position="bottom-right" closeButton />
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  </StrictMode>,
)
