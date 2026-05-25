/**
 * src/store.ts — Central Zustand store for nnbookmaker
 *
 * Holds all shared application state: manuscript source, parsed HTML +
 * frontmatter, CSS token overrides, custom CSS, and project configuration
 * (trim size, active theme).
 *
 * setSource triggers parseMd asynchronously. A generation counter guards
 * against stale responses: if a newer setSource call completes parseMd before
 * an older one, the older result is silently discarded.
 */

import { create } from 'zustand';
import { parseMd } from '../engine/pipeline/index.ts';
import { DEFAULT_TRIM, TrimSizeKey } from './trimSizes.ts';

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface BookStore {
  // ── Manuscript ────────────────────────────────────────────────────────────
  /** Raw Markdown source text. */
  source: string;
  /** Rendered HTML produced by parseMd(). */
  html: string;
  /** Frontmatter key/value pairs extracted from the YAML block. */
  frontmatter: Record<string, unknown>;
  /**
   * Update the source and trigger an async parseMd run.
   * The store's html and frontmatter are updated once parseMd resolves.
   * A generation counter prevents stale results from overwriting newer ones.
   */
  setSource: (src: string) => void;

  // ── Token overrides ───────────────────────────────────────────────────────
  /**
   * Map of CSS custom property name → override value.
   * e.g. { '--book-trim-width': '152.4mm', '--book-trim-height': '228.6mm' }
   * Components read this to apply token overrides on top of the default theme.
   */
  tokenOverrides: Record<string, string>;
  /** Set (or update) a single CSS custom property override. */
  setTokenOverride: (prop: string, value: string) => void;
  /** Remove a single token override, reverting that property to its CSS default. */
  removeTokenOverride: (prop: string) => void;
  /** Remove all token overrides, reverting to the default theme values. */
  resetTokenOverrides: () => void;
  /**
   * Monotonically increasing counter, incremented by setTokenOverride.
   * Pass as a prop to PagedPreview to trigger re-render on token changes.
   */
  tokenVersion: number;

  // ── Custom CSS ────────────────────────────────────────────────────────────
  /** User-authored CSS injected into the @layer overrides layer in the iframe. */
  customCss: string;
  setCustomCss: (css: string) => void;

  // ── Project config ────────────────────────────────────────────────────────
  /** Trim size key, e.g. '6x9' or '5x8'. */
  trimSize: TrimSizeKey;
  setTrimSize: (size: TrimSizeKey) => void;
  /**
   * Custom trim dimensions (in mm, as strings) used when trimSize === 'custom'.
   * Stored as strings so number inputs stay in sync without coercion glitches.
   */
  customTrimWidth: string;
  customTrimHeight: string;
  setCustomTrim: (width: string, height: string) => void;
  /** Active theme name, e.g. 'default'. */
  activeTheme: string;
  setActiveTheme: (name: string) => void;
}

// ─── Internal generation counter ─────────────────────────────────────────────
// Lives outside the store so it does not cause unnecessary re-renders.
// Incremented each time setSource fires parseMd; the resolved callback
// checks that its captured gen still matches before writing to the store.
//
// Module-level singleton counter — safe because create() is called once per
// module evaluation. Tests that reset modules must also reset this counter.
let _parseMdGeneration = 0;

// ─── Store factory ────────────────────────────────────────────────────────────

export const useBookStore = create<BookStore>((set) => ({
  // ── Manuscript ─────────────────────────────────────────────────────────────
  source: '',
  html: '',
  frontmatter: {},

  setSource: (src: string) => {
    // Update source immediately so the editor always reflects user input.
    set({ source: src });

    // Capture the generation for this invocation.
    const gen = ++_parseMdGeneration;

    parseMd(src)
      .then(({ html, frontmatter }) => {
        // Only apply the result if no newer setSource call has superseded this one.
        if (gen === _parseMdGeneration) {
          set({ html, frontmatter });
        }
      })
      .catch((err) => {
        console.error('parseMd failed:', err);
      });
  },

  // ── Token overrides ────────────────────────────────────────────────────────
  tokenOverrides: {},
  tokenVersion: 0,

  setTokenOverride: (prop: string, value: string) =>
    set((state) => ({
      tokenOverrides: { ...state.tokenOverrides, [prop]: value },
      tokenVersion: state.tokenVersion + 1,
    })),

  removeTokenOverride: (prop: string) =>
    set((state) => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty(prop);
      }
      const next = { ...state.tokenOverrides };
      delete next[prop];
      return { tokenOverrides: next, tokenVersion: state.tokenVersion + 1 };
    }),

  resetTokenOverrides: () => {
    set((state) => {
      if (typeof document !== 'undefined') {
        Object.keys(state.tokenOverrides).forEach((prop) => {
          document.documentElement.style.removeProperty(prop);
        });
      }
      return { tokenOverrides: {}, tokenVersion: state.tokenVersion + 1 };
    });
  },

  // ── Custom CSS ─────────────────────────────────────────────────────────────
  customCss: '',
  setCustomCss: (css: string) => set({ customCss: css }),

  // ── Project config ─────────────────────────────────────────────────────────
  trimSize: DEFAULT_TRIM,
  setTrimSize: (size: TrimSizeKey) => set({ trimSize: size }),

  // Only meaningful when trimSize === 'custom'; ignored for all concrete sizes.
  customTrimWidth: '',
  customTrimHeight: '',
  setCustomTrim: (width: string, height: string) =>
    set({ customTrimWidth: width, customTrimHeight: height }),

  activeTheme: 'default',
  setActiveTheme: (name: string) => set({ activeTheme: name }),
}));
