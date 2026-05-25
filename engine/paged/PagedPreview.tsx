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

import { useEffect, useRef, useCallback } from 'react';

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

// Page geometry — resolves CSS custom property tokens to concrete @page rules
// (spec §3.4 / D-08b: var() does not cascade into @page across paged engines).
import { generatePageGeometry } from '../page-geometry';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PagedPreviewProps {
  /** The HTML string produced by parseMd() — book body content only. */
  html: string;
}

// ─── Page position helpers ────────────────────────────────────────────────────

/**
 * Read the index of the first .pagedjs_page element that is currently visible
 * in the iframe's viewport (i.e. its top edge is at or below scrollY).
 * Returns 0 if the iframe is not yet ready or no pages exist.
 */
function readVisiblePageIndex(iframe: HTMLIFrameElement): number {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return 0;
    const pages = doc.querySelectorAll<HTMLElement>('.pagedjs_page');
    if (pages.length === 0) return 0;
    const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
    // Find the last page whose top edge is at or above the current scrollY.
    // That is the page that is "in view" at the top of the viewport.
    let idx = 0;
    for (let i = 0; i < pages.length; i++) {
      // +1 sub-pixel tolerance: offsetTop uses integer pixels but scrollY can
      // be fractional on high-DPI screens; the small bias avoids flipping to
      // the previous page when the viewport is aligned exactly to a page edge.
      if (pages[i].offsetTop <= scrollY + 1) {
        idx = i;
      }
    }
    return idx;
  } catch {
    return 0;
  }
}

/**
 * Scroll the iframe to the page at the given index (0-based).
 * Reads the offsetTop of the nth .pagedjs_page element and sets scrollTop.
 */
function scrollToPageIndex(iframe: HTMLIFrameElement, idx: number): void {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const pages = doc.querySelectorAll<HTMLElement>('.pagedjs_page');
    const target = pages[Math.min(idx, pages.length - 1)];
    if (target) {
      doc.documentElement.scrollTop = target.offsetTop;
    }
  } catch {
    // iframe may not be accessible — ignore
  }
}

// ─── srcdoc builder ──────────────────────────────────────────────────────────

/**
 * Builds the full standalone HTML document written into the iframe.
 *
 * The document includes:
 *   1. Inlined token CSS layers (in declaration order)
 *   2. Resolved @page geometry rule (literal values — no var() — generated
 *      by reading CSS custom properties in the parent frame; see §3.4 / D-08b)
 *   3. Book content wrapped in <div id="book-content">
 *   4. Paged.js polyfill script — auto-runs on window load
 *   5. A small inline script that posts a "pagedjs:rendered" message to the
 *      parent window once Paged.js fires its `rendered` event, so the parent
 *      can restore scroll position after repagination completes.
 *
 * The script src is an absolute path served from /public by Vite dev server
 * and from the build output in production. The iframe inherits the same
 * origin so /paged.polyfill.js resolves correctly.
 *
 * @param html        Book body HTML string from parseMd()
 * @param pageGeomCSS Resolved @page CSS from generatePageGeometry() — must
 *                    contain literal length values, not var() references
 */
function buildSrcdoc(html: string, pageGeomCSS: string): string {
  const inlineStyles = [
    layersCss,
    primitivesCss,
    globalCss,
    semanticCss,
    componentsCss,
    overridesCss,
  ].join('\n\n');

  // @footnote is a CSS Paged Media rule not understood by LightningCSS (the
  // Vite build-time CSS minifier), so it cannot live in components.css directly.
  // It is injected here into the iframe only, bypassing the Vite pipeline.
  const pagedMediaExtras = `
@layer components {
  @page {
    @footnote {
      border-top: 1px solid var(--color-rule);
      padding-top: calc(var(--rhythm-footnote-gap) * var(--book-baseline));
    }
  }
}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Book Preview</title>
  <style>
${inlineStyles}
${pagedMediaExtras}
  </style>
  <style id="page-geometry">
${pageGeomCSS}
  </style>
  <style id="preview-chrome">
    /* Preview chrome — visible pages on a neutral background */
    body {
      background: #e0e0e0;
      margin: 0;
      padding: 2rem;
    }

    .pagedjs_page {
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
  <!-- Notify parent frame when Paged.js finishes rendering so it can
       restore the scroll position to the previously-visible page. -->
  <script>
    (function () {
      function notifyRendered() {
        window.parent.postMessage({ type: 'pagedjs:rendered' }, '*');
      }
      // PagedPolyfill may already exist if the polyfill script ran
      // synchronously, or it may not be set up yet — wait for DOMContentLoaded
      // to be safe, then hook into the rendered event.
      document.addEventListener('DOMContentLoaded', function () {
        if (window.PagedPolyfill && typeof window.PagedPolyfill.on === 'function') {
          window.PagedPolyfill.on('rendered', notifyRendered);
        } else {
          // Fallback: if the Paged.js hook API is unavailable, fire after 800 ms
          // to allow pagination to finish. 800 ms is a rough heuristic that
          // works for typical short manuscripts (~50 pages); very long documents
          // may still be paginating when this fires, causing a scroll position
          // that doesn't line up with the correct page.
          setTimeout(notifyRendered, 800);
        }
      });
    })();
  </script>
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
 *
 * Position restore:
 *   Before writing new srcdoc, the current visible page index is saved.
 *   After Paged.js fires its `rendered` event (communicated via postMessage
 *   from inside the iframe), the preview scrolls back to the same page index.
 */
export function PagedPreview({ html }: PagedPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Stores the page index to restore after the next repagination.
  const savedPageIndexRef = useRef<number>(0);

  // Listen for the pagedjs:rendered postMessage from the iframe.
  // When it arrives, scroll the iframe back to the saved page index.
  const handleMessage = useCallback((event: MessageEvent) => {
    // Ignore messages that did not originate from our iframe's content window
    // to guard against third-party postMessage spoofing.
    if (event.source !== iframeRef.current?.contentWindow) return;
    if (
      event.data &&
      typeof event.data === 'object' &&
      event.data.type === 'pagedjs:rendered'
    ) {
      const iframe = iframeRef.current;
      if (iframe) {
        scrollToPageIndex(iframe, savedPageIndexRef.current);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Save the current visible page index before we wipe the document.
    savedPageIndexRef.current = readVisiblePageIndex(iframe);

    // Write the full document into the iframe. Using srcdoc attribute keeps
    // the iframe same-origin (about:srcdoc), which lets the polyfill script
    // load from the parent origin via absolute /paged.polyfill.js path.
    //
    // We reassign srcdoc rather than contentDocument.write() to avoid
    // needing to call document.open/close and to let the browser parse
    // cleanly from scratch on each update.
    //
    // generatePageGeometry reads CSS custom properties from the parent frame's
    // document root. The parent has the same token CSS loaded (same origin,
    // same Vite module graph), so the resolved values are identical to what
    // the iframe would read — but without the var()-in-@page limitation.
    const pageGeomCSS = generatePageGeometry(document.documentElement);
    iframe.srcdoc = buildSrcdoc(html, pageGeomCSS);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Book Preview"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
    />
  );
}

export default PagedPreview;
