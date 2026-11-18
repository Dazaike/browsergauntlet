import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { installWindowApi } from '@/lib/report'
import { applyUrlConfig } from '@/lib/urlConfig'
import '@/index.css'

// Persisted state hydrates synchronously; then apply ?seed=…&mode=… overrides.
applyUrlConfig()
installWindowApi()

// StrictMode is intentionally off: challenges measure real pointer/time behaviour and
// double-invoked effects would pollute the activity log with duplicate events.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
