import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import PagedPreview from '../engine/paged/PagedPreview.tsx';
import sampleMd from '../manuscripts/sample.md?raw';
import TrimSizeSelector from './components/TrimSizeSelector.tsx';
import { useBookStore } from './store.ts';
import { DEFAULT_TRIM, TRIM_SIZES } from './trimSizes.ts';

const DEBOUNCE_MS = 300;

export default function App() {
  // ── Store selectors ──────────────────────────────────────────────────────
  const source = useBookStore((s) => s.source);
  const html = useBookStore((s) => s.html);
  const trimSize = useBookStore((s) => s.trimSize);
  const customTrimWidth = useBookStore((s) => s.customTrimWidth);
  const customTrimHeight = useBookStore((s) => s.customTrimHeight);
  const setSource = useBookStore((s) => s.setSource);

  // ── Debounce timer ───────────────────────────────────────────────────────
  // Debounce is a UI concern: we do not want parseMd firing on every keystroke.
  // The store's setSource handles async parseMd + stale-response guarding;
  // App.tsx is responsible for deciding *when* to call it.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initialise with sample manuscript ────────────────────────────────────
  // Call setSource once on mount so the store runs parseMd on the initial text.
  useEffect(() => {
    setSource(sampleMd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once; setSource is stable (Zustand action)

  // ── Cleanup pending debounce on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Trim-size CSS custom properties ──────────────────────────────────────
  // Apply --book-trim-width / --book-trim-height to the document root
  // synchronously before paint. useLayoutEffect fires before child useEffects,
  // so PagedPreview's useEffect always reads the already-updated values from
  // getComputedStyle when trimSize changes.
  useLayoutEffect(() => {
    let width: string;
    let height: string;
    if (trimSize === 'custom') {
      // Only apply when both dimensions are non-empty numbers.
      const w = parseFloat(customTrimWidth);
      const h = parseFloat(customTrimHeight);
      if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
        width = `${w}mm`;
        height = `${h}mm`;
      } else {
        return; // incomplete custom — keep whatever was set previously
      }
    } else {
      ({ width, height } = TRIM_SIZES[trimSize] ?? TRIM_SIZES[DEFAULT_TRIM]);
    }
    document.documentElement.style.setProperty('--book-trim-width', width);
    document.documentElement.style.setProperty('--book-trim-height', height);
  }, [trimSize, customTrimWidth, customTrimHeight]);

  // ── Textarea change handler ───────────────────────────────────────────────
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;

      // Debounce: reset the timer on every keystroke, calling store setSource
      // (which triggers parseMd) only after the user pauses.
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        setSource(text);
      }, DEBOUNCE_MS);

      // Write source immediately so the textarea stays responsive.
      // setSource (called after the debounce) will also write source before
      // running parseMd — this double-write is harmless; the second write is
      // identical and the generation counter guards the parseMd result.
      useBookStore.setState({ source: text });
    },
    [setSource]
  );

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
          <textarea
            value={source}
            onChange={handleSourceChange}
            spellCheck={false}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              padding: '12px',
              fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#d4d4d4',
              background: 'transparent',
              overflowY: 'auto',
              whiteSpace: 'pre',
              tabSize: 2,
            }}
          />
        </div>

        {/* Right panel: paged preview */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {html ? (
            <PagedPreview html={html} trimSize={trimSize} />
          ) : (
            <div style={{ padding: '2rem', color: '#888' }}>Rendering…</div>
          )}
        </div>
      </div>
    </div>
  );
}
