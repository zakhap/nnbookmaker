/**
 * engine/paged/PagedPreview — isolated iframe host for Paged.js
 *
 * Renders book HTML inside a sandboxed <iframe> so Paged.js DOM mutations
 * never touch the React reconciler tree (spec §3.6 / D-13).
 *
 * The iframe receives a full standalone HTML document via srcdoc.
 * Paged.js (polyfill build) auto-runs when the document loads.
 * Token CSS layers are inlined as <style> tags.
 *
 * ─── Paged.js quirks discovered during Phase 0 validation ───────────────────
 *
 * Q1 — var() does not resolve inside @page descriptors (D-08b).
 *   Paged.js parses @page rules at polyfill load time, before CSS custom
 *   properties are fully resolved. Any `size: var(--w) var(--h)` in @page is
 *   silently ignored (page stays at A4 default). Fix: generatePageGeometry()
 *   reads resolved values from getComputedStyle in the parent frame and writes
 *   a literal `@page { size: 127mm 203.2mm; }` into the iframe's <style>.
 *
 * Q2 — @page rules must be present in the document *before* the polyfill runs.
 *   Paged.js reads the stylesheet cascade on init and does not re-process @page
 *   if rules are added or mutated afterwards. This is why the geometry <style>
 *   block is placed in <head> ahead of the polyfill <script> tag in buildSrcdoc,
 *   and why the entire srcdoc is replaced (not patched) when trim size changes.
 *
 * Q3 — @footnote is not understood by LightningCSS (Vite's CSS transformer).
 *   `@page { @footnote { … } }` causes a build-time parse error if placed in
 *   any .css file that passes through the Vite pipeline. It is injected as a
 *   raw string directly into the iframe srcdoc (see `pagedMediaExtras` in
 *   buildSrcdoc) to bypass the transformer entirely.
 *
 * Q4 — PagedPolyfill.on('rendered', cb) hook is only available from v0.4+.
 *   On some environments / CDN builds the hook API may be absent. The fallback
 *   is an 800 ms setTimeout that fires notifyRendered unconditionally. This is
 *   a heuristic; very long manuscripts may still be paginating when it fires.
 *   A more robust solution would poll for `.pagedjs_page` elements or wire into
 *   the Paged.js Chunker lifecycle directly.
 *
 * Q5 — Trim-size switching requires full srcdoc replacement.
 *   Changing the `size` descriptor in an existing @page rule after Paged.js has
 *   run does NOT cause re-pagination. The polyfill must be re-invoked from
 *   scratch, which means the entire iframe document must be replaced. This is
 *   already how PagedPreview works (srcdoc reassignment), so trim switching is
 *   handled correctly by adding `trimSize` to the useEffect dependency array.
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

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

// ─── Imperative handle ────────────────────────────────────────────────────────

/**
 * Methods exposed to the parent via `ref` when using `forwardRef`.
 * The parent calls `previewRef.current.triggerPrint()` to open the browser
 * print dialog scoped to the iframe document (which produces a clean PDF via
 * "Save as PDF" in the system print dialog).
 */
export interface PagedPreviewHandle {
  triggerPrint: () => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PagedPreviewProps {
  /** The HTML string produced by parseMd() — book body content only. */
  html: string;
  /**
   * Trim size key — used as a useEffect dependency sentinel to trigger
   * re-render on trim change. Changing this prop causes PagedPreview to
   * re-run its useEffect and re-read CSS custom properties from the parent
   * frame, which by then have already been updated by App.tsx's
   * useLayoutEffect via style.setProperty. This is the mechanism that drives
   * live trim-size switching.
   */
  trimSize?: string;
  /**
   * Monotonically increasing counter supplied by the Zustand store.
   * Incremented by setTokenOverride each time a CSS custom property is
   * changed via the TokenPanel. Including this in the useEffect dependency
   * array causes PagedPreview to rebuild and re-render the iframe document
   * whenever any design token is updated.
   */
  tokenVersion?: number;
  /**
   * User-authored CSS to inject into the @layer overrides layer inside the
   * iframe. Wrapped in `@layer overrides { … }` and appended after the
   * inlined overrides.css content so it wins by layer priority without
   * needing !important or elevated specificity.
   */
  customCss?: string;
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
 * @param customCss   User-authored CSS wrapped in `@layer overrides { … }` and
 *                    appended after the inlined overrides.css — wins by layer
 *                    priority without !important or elevated specificity
 */
function buildSrcdoc(html: string, pageGeomCSS: string, customCss = ''): string {
  // User CSS is wrapped in @layer overrides so it takes priority over every
  // lower layer (primitives, global, semantic, components) without needing
  // elevated specificity or !important. The empty overridesCss file is still
  // included first to ensure the layer is declared before the user rules.
  //
  // Sanitize </style> sequences so the HTML parser cannot break out of the
  // <style> block even on a local-only tool (defense in depth).
  const safeCustomCss = customCss.replace(/<\/style/gi, '<\\/style');
  // Note: if the user types `@layer overrides { }` directly in the editor, it
  // creates a sublayer `overrides.overrides`, which has lower priority than
  // plain rules placed directly inside this outer @layer overrides block.
  const userOverrides = safeCustomCss.trim()
    ? `\n@layer overrides {\n${safeCustomCss}\n}`
    : '';

  const inlineStyles = [
    layersCss,
    primitivesCss,
    globalCss,
    semanticCss,
    componentsCss,
    overridesCss,
    userOverrides,
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
      outline: 1px solid #bbb;
    }

    /* Print / PDF export — strip the preview chrome so the PDF contains
       clean white pages at the exact @page trim size. Paged.js handles all
       the actual layout; we only need to remove the background colour, the
       page gap, and the drop-shadow that would otherwise appear in the PDF. */
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }

      .pagedjs_page {
        box-shadow: none;
        margin: 0;
      }
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
       restore the scroll position to the previously-visible page.
       Also handles { type: 'print' } messages from the parent, which trigger
       window.print() on the iframe document for proofing PDF export. -->
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

      // Listen for { type: 'print' } from the parent frame.
      // Calling window.print() from inside the iframe prints only the iframe
      // document (the fully-paginated book), not the surrounding app shell.
      window.addEventListener('message', function (event) {
        // Guard against spoofed postMessage from unrelated windows.
        if (event.source !== window.parent) return;
        if (event.data && event.data.type === 'print') {
          window.print();
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
export const PagedPreview = forwardRef<PagedPreviewHandle, PagedPreviewProps>(
  function PagedPreview({ html, trimSize, tokenVersion, customCss }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Stores the page index to restore after the next repagination.
    const savedPageIndexRef = useRef<number>(0);

    // Expose triggerPrint() to the parent component via the forwarded ref.
    // Sends a { type: 'print' } message into the iframe so the iframe calls
    // window.print() — which prints only the paginated book document, not the
    // surrounding app shell.
    useImperativeHandle(ref, () => ({
      triggerPrint() {
        // '*' is required here because srcdoc iframes have a null/opaque origin
        // (about:srcdoc), so a specific origin string cannot be targeted — any
        // concrete origin would silently fail to match.
        iframeRef.current?.contentWindow?.postMessage({ type: 'print' }, '*');
      },
    }), []);

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
      // generatePageGeometry re-reads CSS custom properties from the parent frame
      // on every call. App.tsx uses useLayoutEffect to write CSS vars synchronously
      // before this useEffect reads them, so getComputedStyle always picks up the
      // new --book-trim-width / --book-trim-height when trimSize changes.
      // See Quirk Q1 / Q2 / Q5 in the file-level JSDoc for why this full-replace
      // strategy is required instead of patching the existing @page rule.
      const pageGeomCSS = generatePageGeometry(document.documentElement);
      iframe.srcdoc = buildSrcdoc(html, pageGeomCSS, customCss);
    }, [html, trimSize, tokenVersion, customCss]);

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
  },
);

export default PagedPreview;
