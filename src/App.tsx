import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PagedPreview, { type PagedPreviewHandle } from '../engine/paged/PagedPreview.tsx';
import sampleMd from '../manuscripts/sample.md?raw';
import CustomCssEditor from './components/CustomCssEditor.tsx';
import ManuscriptEditor from './components/ManuscriptEditor.tsx';
import TokenPanel from './components/TokenPanel.tsx';
import TrimSizeSelector from './components/TrimSizeSelector.tsx';
import { useBookStore } from './store.ts';
import { CONCRETE_TRIM_SIZES, DEFAULT_TRIM } from './trimSizes.ts';
import type { ConcreteTrimKey } from './trimSizes.ts';

export default function App() {
  // ── Store selectors ──────────────────────────────────────────────────────
  const html = useBookStore((s) => s.html);
  const source = useBookStore((s) => s.source);
  const trimSize = useBookStore((s) => s.trimSize);
  const customTrimWidth = useBookStore((s) => s.customTrimWidth);
  const customTrimHeight = useBookStore((s) => s.customTrimHeight);
  const tokenVersion = useBookStore((s) => s.tokenVersion);
  const tokenOverrides = useBookStore((s) => s.tokenOverrides);
  const customCss = useBookStore((s) => s.customCss);
  const setSource = useBookStore((s) => s.setSource);

  // ── File management ──────────────────────────────────────────────────────
  const [fileName, setFileName] = useState<string>('sample.md');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const savedTextRef = useRef<string>(sampleMd);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mark dirty whenever source diverges from last saved text
  useEffect(() => {
    setIsDirty(source !== savedTextRef.current);
  }, [source]);

  const handleOpenFile = useCallback(async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.txt'] } }],
          excludeAcceptAllOption: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        fileHandleRef.current = handle;
        savedTextRef.current = text;
        setFileName(file.name);
        setIsDirty(false);
        setSource(text);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [setSource]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileHandleRef.current = null;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      savedTextRef.current = text;
      setIsDirty(false);
      setSource(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setSource]);

  const handleSaveFile = useCallback(async () => {
    const text = useBookStore.getState().source;
    const handle = fileHandleRef.current;

    if (handle) {
      try {
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        savedTextRef.current = text;
        setIsDirty(false);
        return;
      } catch (err) {
        console.error('Save failed:', err);
      }
    }

    if ('showSaveFilePicker' in window) {
      try {
        const saveHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }],
        });
        fileHandleRef.current = saveHandle;
        const writable = await saveHandle.createWritable();
        await writable.write(text);
        await writable.close();
        savedTextRef.current = text;
        setFileName((await saveHandle.getFile()).name);
        setIsDirty(false);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      }
    } else {
      // Fallback: trigger download
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      savedTextRef.current = text;
      setIsDirty(false);
    }
  }, [fileName]);

  // ── PDF export ───────────────────────────────────────────────────────────
  const previewRef = useRef<PagedPreviewHandle>(null);

  const handleExportPdf = useCallback(() => {
    previewRef.current?.triggerPrint();
  }, []);

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

  // Inject tokenOverrides into the iframe as :root { --prop: value; } inside
  // @layer overrides, so panel controls take effect on CSS custom properties
  // that don't go through generatePageGeometry (type scale, measure, etc.).
  const tokenOverrideCss = Object.keys(tokenOverrides).length > 0
    ? `:root {\n${Object.entries(tokenOverrides).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
    : '';
  const fullCustomCss = [tokenOverrideCss, customCss].filter(Boolean).join('\n\n');

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
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleExportPdf}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontFamily: 'inherit',
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            Export PDF
          </button>
        </div>
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
              padding: '4px 8px',
              fontSize: '11px',
              color: '#888',
              borderBottom: '1px solid #333',
              flexShrink: 0,
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}{isDirty ? ' •' : ''}
            </span>
            <button
              type="button"
              onClick={handleOpenFile}
              style={{
                padding: '2px 7px',
                fontSize: '10px',
                fontFamily: 'inherit',
                background: '#2a2a2a',
                color: '#aaa',
                border: '1px solid #444',
                borderRadius: '3px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Open
            </button>
            <button
              type="button"
              onClick={handleSaveFile}
              disabled={!isDirty}
              style={{
                padding: '2px 7px',
                fontSize: '10px',
                fontFamily: 'inherit',
                background: isDirty ? '#2a3a2a' : '#222',
                color: isDirty ? '#7ec87e' : '#555',
                border: `1px solid ${isDirty ? '#4a6a4a' : '#333'}`,
                borderRadius: '3px',
                cursor: isDirty ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              Save
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>
          <ManuscriptEditor />
        </div>

        {/* Right panel: paged preview */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {html ? (
            <PagedPreview ref={previewRef} html={html} trimSize={trimSize} tokenVersion={tokenVersion} customCss={fullCustomCss} />
          ) : (
            <div style={{ padding: '2rem', color: '#888' }}>Rendering…</div>
          )}
        </div>
      </div>

      {/* Token panel — fixed overlay, collapsed by default */}
      <TokenPanel />

      {/* Custom CSS editor — fixed overlay, collapsed by default */}
      <CustomCssEditor />
    </div>
  );
}
