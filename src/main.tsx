import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StealthProvider from './features/stealth/StealthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StealthProvider>
      <App />
    </StealthProvider>
  </StrictMode>,
)
