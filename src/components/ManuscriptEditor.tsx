/**
 * src/components/ManuscriptEditor.tsx
 *
 * CodeMirror 6 editor for the manuscript pane.
 *
 * - Markdown syntax highlighting via @codemirror/lang-markdown
 * - YAML front matter block (opening ---…--- ) highlighted with a custom
 *   ViewPlugin decoration so it stands out from body prose
 * - Editor value is kept in sync with the Zustand store's `source` field
 * - On doc change, updates are debounced 300 ms before calling setSource
 *   (which triggers the async parseMd pipeline)
 * - The component owns the EditorView lifecycle (create on mount, destroy on
 *   unmount) and updates the editor content when the store source changes
 *   externally (e.g. initial seed from sampleMd)
 */

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  ViewPlugin,
  Decoration,
  type DecorationSet,
  ViewUpdate,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { useBookStore } from '../store.ts';

// ─── DEBOUNCE ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ─── THEME ────────────────────────────────────────────────────────────────────
// Dark theme matching the existing textarea appearance (bg #1e1e1e, text #d4d4d4)

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '12px',
      fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
    },
    '.cm-content': {
      padding: '12px',
      lineHeight: '1.6',
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
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '2.5em',
    },
    '.cm-activeLine': { background: '#2a2a2a' },
    '.cm-activeLineGutter': { background: '#2a2a2a' },
    '.cm-selectionBackground, ::selection': { background: '#264f78' },
    // Frontmatter decoration
    '.cm-frontmatter-line': {
      color: '#9cdcfe',
      background: '#1e2a3a',
    },
    '.cm-frontmatter-fence': {
      color: '#608b4e',
      fontWeight: 'bold',
    },
  },
  { dark: true }
);

// ─── MARKDOWN HIGHLIGHT STYLE ─────────────────────────────────────────────────

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#569cd6', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading2, color: '#9cdcfe', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#4ec9b0', fontWeight: 'bold' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: '#4ec9b0' },
  { tag: tags.strong, color: '#d4d4d4', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#d4d4d4', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: '#888', textDecoration: 'line-through' },
  { tag: tags.url, color: '#ce9178' },
  { tag: tags.link, color: '#4ec9b0' },
  { tag: tags.monospace, color: '#ce9178', background: '#2d2d2d' },
  { tag: tags.quote, color: '#608b4e', fontStyle: 'italic' },
  { tag: tags.list, color: '#d4d4d4' },
  { tag: tags.meta, color: '#608b4e' },
  { tag: tags.comment, color: '#6a9955' },
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.bool, color: '#569cd6' },
  { tag: tags.contentSeparator, color: '#608b4e' },
  { tag: tags.processingInstruction, color: '#808080' },
]);

// ─── FRONTMATTER DECORATION PLUGIN ───────────────────────────────────────────
// Scans the document for an opening YAML front-matter block (---\n…\n---) and
// applies line decorations to make it visually distinct.

function buildFrontmatterDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();

  // Front matter must start at position 0 with "---\n" (or "---\r\n")
  if (!text.startsWith('---')) {
    return Decoration.none;
  }

  // Find the closing --- fence
  const firstNewline = text.indexOf('\n', 0);
  if (firstNewline === -1) return Decoration.none;

  const afterFirstFence = firstNewline + 1;
  // Look for "---" on its own line after the opening fence
  const closingFenceRe = /^---[ \t]*$/m;
  const match = closingFenceRe.exec(text.slice(afterFirstFence));
  if (!match) return Decoration.none;

  const closingStart = afterFirstFence + match.index;
  const closingEnd = closingStart + match[0].length;

  const decorations: Range<Decoration>[] = [];
  const fenceClass = Decoration.line({ class: 'cm-frontmatter-fence' });
  const bodyClass = Decoration.line({ class: 'cm-frontmatter-line' });

  // Walk line objects by number — avoids unused iterator variables
  const totalLines = doc.lines;
  for (let lineNum = 1; lineNum <= totalLines; lineNum++) {
    const lineObj = doc.line(lineNum);
    if (lineObj.from > closingEnd) break;

    const isFence =
      lineNum === 1 || (lineObj.from >= closingStart && lineObj.from <= closingEnd);
    if (isFence) {
      decorations.push(fenceClass.range(lineObj.from));
    } else {
      decorations.push(bodyClass.range(lineObj.from));
    }
  }

  return Decoration.set(decorations);
}

const frontmatterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildFrontmatterDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildFrontmatterDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function ManuscriptEditor() {
  const source = useBookStore((s) => s.source);
  const setSource = useBookStore((s) => s.setSource);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the source value that the editor currently reflects so we can avoid
  // feeding external updates back into the view when the text is identical.
  const editorDocRef = useRef<string>('');

  // ── Create the EditorView on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (!update.docChanged) return;
      const text = update.state.doc.toString();
      editorDocRef.current = text;

      // Immediately write source (unthrottled) so the store stays in sync with
      // the editor's raw text — this mirrors what the old textarea did with
      // `useBookStore.setState({ source: text })`.
      useBookStore.setState({ source: text });

      // Debounce the expensive parseMd call
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        setSource(text);
      }, DEBOUNCE_MS);
    });

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        drawSelection(),
        dropCursor(),
        markdown(),
        syntaxHighlighting(markdownHighlight),
        frontmatterPlugin,
        editorTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorDocRef.current = source;
    viewRef.current = view;

    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount — the view manages its own state

  // ── Sync external source changes into the editor ───────────────────────────
  // When the store's source changes from outside the editor (e.g. the initial
  // seed from sampleMd), update the editor content without triggering our own
  // updateListener loop.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (source === editorDocRef.current) return; // no-op: editor already has this text

    const currentDoc = view.state.doc.toString();
    if (source === currentDoc) {
      editorDocRef.current = source;
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
    });
    editorDocRef.current = source;
  }, [source]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    />
  );
}
