import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/swRegister'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// アプリシェルをオフラインで起動できるようにする（課題7b・Phase F）。本番のみ有効。
registerServiceWorker()
