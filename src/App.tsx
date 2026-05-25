import { useEffect, useLayoutEffect } from 'react';
import PagedPreview from '../engine/paged/PagedPreview.tsx';
import sampleMd from '../manuscripts/sample.md?raw';
import ManuscriptEditor from './components/ManuscriptEditor.tsx';
import TokenPanel from './components/TokenPanel.tsx';
import TrimSizeSelector from './components/TrimSizeSelector.tsx';
import { useBookStore } from './store.ts';
import { CONCRETE_TRIM_SIZES, DEFAULT_TRIM } from './trimSizes.ts';
import type { ConcreteTrimKey } from './trimSizes.ts';

export default function App() {
  // ── Store selectors ──────────────────────────────────────────────────────
  const html = useBookStore((s) => s.html);
  const trimSize = useBookStore((s) => s.trimSize);
  const customTrimWidth = useBookStore((s) => s.customTrimWidth);
  const customTrimHeight = useBookStore((s) => s.customTrimHeight);
  const tokenVersion = useBookStore((s) => s.tokenVersion);
  const setSource = useBookStore((s) => s.setSource);

  // ── Initialise with sample manuscript ────────────────────────────────────
  // Call setSource once on mount so the store runs parseMd on the initial text.
  useEffect(() => {
    setSource(sampleMd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once; setSource is stable (Zustand action)

  // ── Trim-size CSS custom properties ──────────────────────────────────────
  // Apply --book-trim-width / --book-trim-height to the document root
  // synchronously before paint. useLayoutEffect fires before child useEffects,
  // so PagedPreview's useEffect always reads the already-updated values from
  // getComputedStyle when trimSize changes.
  useLayoutEffect(() => {
    let width: string;
    let height: string;
    if (trimSize === 'custom') {
      const w = parseFloat(customTrimWidth);
      const h = parseFloat(customTrimHeight);
      if (w >= 50 && w <= 400 && h >= 50 && h <= 600) {
        document.documentElement.style.setProperty('--book-trim-width', `${w}mm`);
        document.documentElement.style.setProperty('--book-trim-height', `${h}mm`);
      }
      // If out of range, leave existing tokens in place
      return;
    } else {
      ({ width, height } = CONCRETE_TRIM_SIZES[trimSize as ConcreteTrimKey] ?? CONCRETE_TRIM_SIZES[DEFAULT_TRIM as ConcreteTrimKey]);
    }
    document.documentElement.style.setProperty('--book-trim-width', width);
    document.documentElement.style.setProperty('--book-trim-height', height);
  }, [trimSize, customTrimWidth, customTrimHeight]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #d0d0d0',
          background: '#fafafa',
          fontSize: '13px',
          color: '#555',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <span>nnbookmaker — book preview</span>
        <TrimSizeSelector />
      </header>

      {/* Two-column layout: editor | preview */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {/* Left panel: manuscript editor */}
        <div
          style={{
            width: '360px',
            flexShrink: 0,
            borderRight: '1px solid #d0d0d0',
            display: 'flex',
            flexDirection: 'column',
            background: '#1e1e1e',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              color: '#888',
              borderBottom: '1px solid #333',
              flexShrink: 0,
              fontFamily: 'monospace',
            }}
          >
            manuscript.md
          </div>
          <ManuscriptEditor />
        </div>

        {/* Right panel: paged preview */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {html ? (
            <PagedPreview html={html} trimSize={trimSize} tokenVersion={tokenVersion} />
          ) : (
            <div style={{ padding: '2rem', color: '#888' }}>Rendering…</div>
          )}
        </div>
      </div>

      {/* Token panel — fixed overlay, collapsed by default */}
      <TokenPanel />
    </div>
  );
}
