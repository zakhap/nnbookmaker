import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Token CSS layers — loaded into the parent frame so that generatePageGeometry()
// can read --book-* custom properties via getComputedStyle(document.documentElement).
// Load order is significant: layers declaration first, then tokens in tier order.
import '../tokens/layers.css'
import '../tokens/primitives.css'
import '../tokens/global.css'
import '../tokens/semantic.css'
import '../tokens/components.css'
import '../tokens/overrides.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
