import { useCallback, useEffect, useRef, useState } from 'react';
import { parseMd } from '../engine/pipeline/index.ts';
import PagedPreview from '../engine/paged/PagedPreview.tsx';
import sampleMd from '../manuscripts/sample.md?raw';

const DEBOUNCE_MS = 300;

/** Supported trim size keys and their CSS custom property values. */
const TRIM_SIZES = {
  '5x8': { width: '127mm', height: '203.2mm', label: '5 × 8 in' },
  '6x9': { width: '152.4mm', height: '228.6mm', label: '6 × 9 in' },
} as const;

type TrimSizeKey = keyof typeof TRIM_SIZES;

export default function App() {
  const [source, setSource] = useState(sampleMd);
  const [html, setHtml] = useState('');
  const [trimSize, setTrimSize] = useState<TrimSizeKey>('6x9');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Generation counter: incremented on each debounced parseMd call so that a
  // slow earlier response can never overwrite the result of a newer call.
  const parseMdGeneration = useRef(0);

  // Apply trim-size CSS custom properties to the document root whenever the
  // selected trim size changes. PagedPreview reads these via getComputedStyle
  // inside its own useEffect (which re-runs because trimSize is in its dep array).
  useEffect(() => {
    const { width, height } = TRIM_SIZES[trimSize];
    document.documentElement.style.setProperty('--book-trim-width', width);
    document.documentElement.style.setProperty('--book-trim-height', height);
  }, [trimSize]);

  // Parse on mount with the initial sample
  useEffect(() => {
    parseMd(sampleMd)
      .then(({ html }) => setHtml(html))
      .catch((err) => console.error('parseMd failed:', err));
  }, []);

  // Cleanup: cancel any pending debounce timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSource(text);

    // Debounce repagination: clear any pending timer and restart
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      // Capture the generation at the time this call was issued.
      // If a newer call completes first, gen will be stale and we skip setHtml.
      const gen = ++parseMdGeneration.current;
      parseMd(text)
        .then(({ html }) => {
          if (gen === parseMdGeneration.current) setHtml(html);
        })
        .catch((err) => console.error('parseMd failed:', err));
    }, DEBOUNCE_MS);
  }, []);

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
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 500 }}>Trim:</span>
          <select
            value={trimSize}
            onChange={(e) => setTrimSize(e.target.value as TrimSizeKey)}
            style={{
              fontSize: '12px',
              padding: '2px 6px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            {(Object.keys(TRIM_SIZES) as TrimSizeKey[]).map((key) => (
              <option key={key} value={key}>
                {TRIM_SIZES[key].label}
              </option>
            ))}
          </select>
        </label>
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
