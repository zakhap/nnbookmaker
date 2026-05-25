/**
 * engine/paged/PagedPreview — isolated iframe host for Paged.js
 *
 * Renders book HTML inside a sandboxed <iframe> so Paged.js DOM mutations
 * never touch the React reconciler tree (spec §3.6 / D-13).
 *
 * The iframe receives a full standalone HTML document via srcdoc.
 * Paged.js (polyfill build) auto-runs when the document loads.
 * Token CSS layers are inlined as <style> tags.
 */

import { useEffect, useRef } from 'react';

// Token CSS layers — imported as raw strings so we can inline them
// into the iframe document without a separate network request.
// Load order is significant: layers declaration first, then tokens,
// then component rules.
import layersCss from '../../tokens/layers.css?raw';
import primitivesCss from '../../tokens/primitives.css?raw';
import globalCss from '../../tokens/global.css?raw';
import semanticCss from '../../tokens/semantic.css?raw';
import componentsCss from '../../tokens/components.css?raw';
import overridesCss from '../../tokens/overrides.css?raw';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PagedPreviewProps {
  /** The HTML string produced by parseMd() — book body content only. */
  html: string;
}

// ─── srcdoc builder ──────────────────────────────────────────────────────────

/**
 * Builds the full standalone HTML document written into the iframe.
 *
 * The document includes:
 *   1. Inlined token CSS layers (in declaration order)
 *   2. Minimal @page rule for the default 6×9 trim size
 *   3. Book content wrapped in <div id="book-content">
 *   4. Paged.js polyfill script — auto-runs on window load
 *
 * The script src is an absolute path served from /public by Vite dev server
 * and from the build output in production. The iframe inherits the same
 * origin so /paged.polyfill.js resolves correctly.
 */
function buildSrcdoc(html: string): string {
  const inlineStyles = [
    layersCss,
    primitivesCss,
    globalCss,
    semanticCss,
    componentsCss,
    overridesCss,
  ].join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book Preview</title>
  <style>
${inlineStyles}
  </style>
  <style>
    /* Paged.js page shell */
    @page {
      size: var(--book-trim-width, 6in) var(--book-trim-height, 9in);
      margin-top: var(--book-margin-top, 0.75in);
      margin-bottom: var(--book-margin-bottom, 0.875in);
      margin-left: var(--book-margin-outside, 0.625in);
      margin-right: var(--book-margin-inside, 0.875in);
    }

    /* Preview chrome — visible pages on a neutral background */
    body {
      background: #e8e8e8;
      margin: 0;
      padding: 2rem;
    }

    .pagedjs_page {
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      margin: 0 auto 2rem;
    }
  </style>
</head>
<body>
  <div id="book-content">
${html}
  </div>
  <!-- Paged.js polyfill — auto-paginates the document on load -->
  <script src="/paged.polyfill.js"></script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PagedPreview
 *
 * Renders an <iframe> and writes a full paginated HTML document into it
 * whenever the `html` prop changes. React never touches the iframe's inner
 * DOM — Paged.js owns that subtree entirely.
 *
 * Isolation guarantees:
 *   - The iframe has its own document, so Paged.js DOM mutations are
 *     completely separate from the React component tree.
 *   - User custom CSS (injected into the overrides layer inside the iframe)
 *     cannot bleed into the app shell.
 *   - React reconciliation never sees the Paged.js-generated page nodes.
 */
export default function PagedPreview({ html }: PagedPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Write the full document into the iframe. Using srcdoc attribute keeps
    // the iframe same-origin (about:srcdoc), which lets the polyfill script
    // load from the parent origin via absolute /paged.polyfill.js path.
    //
    // We reassign srcdoc rather than contentDocument.write() to avoid
    // needing to call document.open/close and to let the browser parse
    // cleanly from scratch on each update.
    iframe.srcdoc = buildSrcdoc(html);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Book Preview"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
      }}
    />
  );
}
