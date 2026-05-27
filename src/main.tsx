import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Token CSS layers — loaded into the parent frame so that generatePageGeometry()
// can read --book-* custom properties via getComputedStyle(document.documentElement).
// Only import layers that define :root custom properties (primitives, global, semantic).
// components.css and overrides.css contain element selectors (body, h1, etc.) that
// must NOT apply to the app shell — they belong only inside the iframe.
import '../tokens/layers.css'
import '../tokens/primitives.css'
import '../tokens/global.css'
import '../tokens/semantic.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
