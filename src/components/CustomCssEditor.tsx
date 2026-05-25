/**
 * src/components/CustomCssEditor.tsx
 *
 * CodeMirror 6 editor for user-authored CSS injected into the @layer overrides
 * layer inside the preview iframe. Changes are debounced 300 ms before writing
 * to the Zustand store, which triggers PagedPreview to rebuild the srcdoc with
 * the new CSS wrapped in `@layer overrides { … }`.
 *
 * The editor is surfaced inside an expandable panel similar to TokenPanel — it
 * floats over the layout and is collapsed by default.
 *
 * Depends on @codemirror/lang-css for CSS syntax highlighting and completion.
 */

import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  ViewUpdate,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  highlightSpecialChars,
} from '@codemirror/view';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { css } from '@codemirror/lang-css';
import { useBookStore } from '../store.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ─── Theme ────────────────────────────────────────────────────────────────────

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '12px',
      fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
    },
    '.cm-content': {
      padding: '8px',
      lineHeight: '1.5',
      color: '#d4d4d4',
      caretColor: '#d4d4d4',
    },
    '.cm-focused': { outline: 'none' },
    '.cm-editor': {
      height: '100%',
      background: '#1e1e1e',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
    },
    '.cm-gutters': {
      background: '#1e1e1e',
      borderRight: '1px solid #333',
      color: '#555',
    },
    '.cm-activeLine': { background: '#2a2a2a' },
    '.cm-selectionBackground, ::selection': { background: '#264f78' },
  },
  { dark: true }
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomCssEditor() {
  const customCss = useBookStore((s) => s.customCss);
  const setCustomCss = useBookStore((s) => s.setCustomCss);

  const [expanded, setExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the value the editor currently reflects to avoid feedback loops.
  const editorDocRef = useRef<string>('');

  // ── Create / destroy the EditorView when the panel opens / closes ────────────
  useEffect(() => {
    if (!expanded) {
      // Destroy the view when collapsed to free resources.
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (!update.docChanged) return;
      const text = update.state.doc.toString();
      editorDocRef.current = text;

      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        setCustomCss(text);
      }, DEBOUNCE_MS);
    });

    const state = EditorState.create({
      doc: customCss,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        drawSelection(),
        css(),
        syntaxHighlighting(defaultHighlightStyle),
        editorTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorDocRef.current = customCss;
    viewRef.current = view;

    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]); // rebuild when expanded state changes; setCustomCss is stable

  // ── Sync external store changes into the editor ───────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (customCss === editorDocRef.current) return;

    const currentDoc = view.state.doc.toString();
    if (customCss === currentDoc) {
      editorDocRef.current = customCss;
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: customCss },
    });
    editorDocRef.current = customCss;
  }, [customCss]);

  // ─── Panel chrome ──────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: '232px', // sit to the left of TokenPanel (220px panel + 12px gap)
        zIndex: 100,
        width: '320px',
        background: '#1e1e1e',
        border: '1px solid #444',
        borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid #333' : 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          color: '#ccc',
          fontSize: '12px',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontWeight: 600 }}>Custom CSS (overrides layer)</span>
        <span style={{ color: '#888', fontSize: '10px' }}>
          {expanded ? '▼ collapse' : '▲ expand'}
        </span>
      </button>

      {/* Editor area — only rendered when expanded */}
      {expanded && (
        <div
          style={{
            height: '220px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              color: '#666',
              fontFamily: 'monospace',
              borderBottom: '1px solid #2a2a2a',
              flexShrink: 0,
            }}
          >
            @layer overrides {'{ … }'}
          </div>
          <div
            ref={containerRef}
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          />
        </div>
      )}
    </div>
  );
}
