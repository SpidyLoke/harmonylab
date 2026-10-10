import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { db } from './db/schema'

// Handle for automated browser tests to seed data. Everything is local anyway.
;(window as unknown as { __harmonylab: unknown }).__harmonylab = { db }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
