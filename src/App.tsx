import { useEffect, useState } from 'react';
import { parseMd } from '../engine/pipeline/index.ts';
import PagedPreview from '../engine/paged/PagedPreview.tsx';
import sampleMd from '../manuscripts/sample.md?raw';

export default function App() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    parseMd(sampleMd)
      .then(({ html }) => setHtml(html))
      .catch((err) => console.error('parseMd failed:', err));
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
        }}
      >
        nnbookmaker — book preview
      </header>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {html ? <PagedPreview html={html} /> : <div style={{ padding: '2rem', color: '#888' }}>Rendering…</div>}
      </div>
    </div>
  );
}
