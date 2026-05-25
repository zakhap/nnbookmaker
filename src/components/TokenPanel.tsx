/**
 * TokenPanel — live controls for core CSS design tokens.
 *
 * Renders sliders, number inputs, and selects for the typographic primitives
 * and page-geometry tokens. Each control:
 *   1. Reads its initial value from the document root (or falls back to a
 *      hard-coded default that matches primitives.css / global.css).
 *   2. On change, calls setTokenOverride(prop, value) to update the Zustand
 *      store (which increments tokenVersion, causing PagedPreview to re-render)
 *      AND calls document.documentElement.style.setProperty(prop, value) so
 *      that generatePageGeometry() in PagedPreview reads the fresh value
 *      immediately.
 *
 * Controls exposed:
 *   --pt-base            Base font size (pt, unitless in CSS)
 *   --leading-ratio      Leading multiplier
 *   --scale-ratio        Type scale ratio (named presets)
 *   --book-measure       Text measure / line length (in)
 *   --book-margin-inside   Page margin — spine side (in)
 *   --book-margin-outside  Page margin — fore-edge side (in)
 *   --book-margin-top      Page margin — top (in)
 *   --book-margin-bottom   Page margin — bottom (in)
 *   --book-para-indent   First-line indent (toggle: "1.5em" | "0")
 */

import { useCallback, useState } from 'react';
import { useBookStore } from '../store.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the current value of a CSS custom property from :root.
 * Tries the inline style first (already-overridden token), then computed style.
 * Returns the trimmed string, or `fallback` if the property is unset.
 */
function readCssProp(prop: string, fallback: string): string {
  const el = document.documentElement;
  const inline = el.style.getPropertyValue(prop).trim();
  if (inline) return inline;
  const computed = getComputedStyle(el).getPropertyValue(prop).trim();
  return computed || fallback;
}

/**
 * Parse a CSS length value with a known unit suffix (e.g. "0.875in" → 0.875).
 * Returns `fallback` if the value cannot be parsed.
 */
function parseLengthValue(raw: string, unit: string, fallback: number): number {
  const n = parseFloat(raw.replace(new RegExp(unit + '$'), ''));
  return isFinite(n) ? n : fallback;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: '#aaa',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '2px',
};

const INPUT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  padding: '2px 4px',
  border: '1px solid #444',
  borderRadius: '3px',
  background: '#2a2a2a',
  color: '#ddd',
  width: '54px',
  textAlign: 'right',
};

const SLIDER_STYLE: React.CSSProperties = {
  flex: 1,
  accentColor: '#888',
  cursor: 'pointer',
};

const SELECT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  padding: '2px 4px',
  border: '1px solid #444',
  borderRadius: '3px',
  background: '#2a2a2a',
  color: '#ddd',
  width: '100%',
  cursor: 'pointer',
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'system-ui, sans-serif',
  marginBottom: '6px',
  marginTop: '14px',
};

const ROW_STYLE: React.CSSProperties = {
  marginBottom: '8px',
};

// ─── Scale ratio presets ──────────────────────────────────────────────────────

const SCALE_RATIOS: Array<{ label: string; value: string }> = [
  { label: 'Minor Third — 1.2', value: '1.2' },
  { label: 'Major Third — 1.25', value: '1.25' },
  { label: 'Perfect Fourth — 1.333', value: '1.333' },
  { label: 'Augmented Fourth — 1.414', value: '1.414' },
  { label: 'Perfect Fifth — 1.5', value: '1.5' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  prop: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** If provided, display this suffix after the value (e.g. "pt") */
  displayUnit?: string;
  /** Convert the raw CSS string to a display number */
  parse?: (raw: string) => number;
  /** Convert the control number to a CSS string */
  format?: (n: number) => string;
}

function SliderRow({
  label,
  prop,
  min,
  max,
  step,
  defaultValue,
  displayUnit = '',
  parse,
  format,
}: SliderRowProps) {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);

  const rawDefault = readCssProp(prop, String(defaultValue));
  const parsedDefault = parse ? parse(rawDefault) : parseFloat(rawDefault);
  const initial = isFinite(parsedDefault) ? parsedDefault : defaultValue;

  const [value, setValue] = useState<number>(initial);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(e.target.value);
      if (!isFinite(n)) return;
      setValue(n);
      const cssValue = format ? format(n) : String(n);
      document.documentElement.style.setProperty(prop, cssValue);
      setTokenOverride(prop, cssValue);
    },
    [prop, format, setTokenOverride]
  );

  const displayValue =
    displayUnit ? `${value}${displayUnit}` : String(value);

  return (
    <div style={ROW_STYLE}>
      <div style={LABEL_STYLE}>
        <span>{label}</span>
        <span style={{ color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        style={SLIDER_STYLE}
        aria-label={label}
      />
    </div>
  );
}

interface NumberRowProps {
  label: string;
  prop: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  /** Convert CSS string to display number */
  parse?: (raw: string) => number;
  /** Convert number to CSS string */
  format: (n: number) => string;
}

function NumberRow({
  label,
  prop,
  min,
  max,
  step,
  defaultValue,
  unit,
  parse,
  format,
}: NumberRowProps) {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);

  const rawDefault = readCssProp(prop, `${defaultValue}${unit}`);
  const parsedDefault = parse
    ? parse(rawDefault)
    : parseLengthValue(rawDefault, unit, defaultValue);
  const initial = isFinite(parsedDefault) ? parsedDefault : defaultValue;

  const [value, setValue] = useState<number>(initial);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(e.target.value);
      if (!isFinite(n)) return;
      setValue(n);
      const cssValue = format(n);
      document.documentElement.style.setProperty(prop, cssValue);
      setTokenOverride(prop, cssValue);
    },
    [prop, format, setTokenOverride]
  );

  return (
    <div style={ROW_STYLE}>
      <div style={LABEL_STYLE}>
        <span>{label}</span>
        <span style={{ color: '#777', fontSize: '10px' }}>{unit}</span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        aria-label={label}
        style={INPUT_STYLE}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * TokenPanel
 *
 * A collapsible side-panel containing live controls for the core CSS design
 * tokens. Collapsed by default to avoid cluttering the layout on first load.
 */
export default function TokenPanel() {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);
  const removeTokenOverride = useBookStore((s) => s.removeTokenOverride);

  // ── Collapse state ───────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);

  // ── Scale ratio ──────────────────────────────────────────────────────────
  const rawScaleRatio = readCssProp('--scale-ratio', '1.333');
  const [scaleRatio, setScaleRatio] = useState<string>(rawScaleRatio || '1.333');

  const handleScaleRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setScaleRatio(v);
      document.documentElement.style.setProperty('--scale-ratio', v);
      setTokenOverride('--scale-ratio', v);
    },
    [setTokenOverride]
  );

  // ── Paragraph indent toggle ──────────────────────────────────────────────
  const rawIndent = readCssProp('--book-para-indent', '1.5em');
  // Consider "0" or "0em" or empty as no-indent
  const [indentEnabled, setIndentEnabled] = useState<boolean>(
    rawIndent !== '0' && rawIndent !== '0em' && rawIndent !== ''
  );

  const handleIndentToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setIndentEnabled(checked);
      if (checked) {
        // Remove inline override so the CSS default (calc-based) takes effect
        document.documentElement.style.removeProperty('--book-para-indent');
        removeTokenOverride('--book-para-indent');
      } else {
        document.documentElement.style.setProperty('--book-para-indent', '0');
        setTokenOverride('--book-para-indent', '0');
      }
    },
    [setTokenOverride, removeTokenOverride]
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 100,
          writingMode: 'vertical-rl',
          padding: '10px 6px',
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          color: '#aaa',
          background: '#252525',
          border: '1px solid #444',
          borderRadius: '4px',
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
        aria-label="Open token panel"
      >
        Tokens
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '220px',
        background: '#1c1c1c',
        borderLeft: '1px solid #333',
        overflowY: 'auto',
        zIndex: 100,
        padding: '12px',
        boxSizing: 'border-box',
      }}
      aria-label="Token panel"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          borderBottom: '1px solid #333',
          paddingBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#ccc',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Design Tokens
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 2px',
          }}
          aria-label="Close token panel"
        >
          ×
        </button>
      </div>

      {/* ── Type section ─────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER_STYLE}>Type</div>

      {/* Base font size — unitless number stored in --pt-base */}
      <SliderRow
        label="Base size"
        prop="--pt-base"
        min={8}
        max={18}
        step={0.5}
        defaultValue={11}
        displayUnit="pt"
        parse={(raw) => parseFloat(raw)}
        format={(n) => String(n)}
      />

      {/* Leading ratio */}
      <SliderRow
        label="Leading ratio"
        prop="--leading-ratio"
        min={1.1}
        max={2.0}
        step={0.01}
        defaultValue={1.272727}
        parse={(raw) => parseFloat(raw)}
        format={(n) => String(n)}
      />

      {/* Type scale ratio — named presets */}
      <div style={ROW_STYLE}>
        <div style={LABEL_STYLE}>
          <span>Scale ratio</span>
        </div>
        <select
          value={scaleRatio}
          onChange={handleScaleRatioChange}
          style={SELECT_STYLE}
          aria-label="Type scale ratio"
        >
          {SCALE_RATIOS.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Paragraph model ───────────────────────────────────────────────── */}
      <div style={SECTION_HEADER_STYLE}>Paragraphs</div>

      <div style={{ ...ROW_STYLE, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          id="para-indent-toggle"
          type="checkbox"
          checked={indentEnabled}
          onChange={handleIndentToggle}
          style={{ accentColor: '#888', cursor: 'pointer' }}
        />
        <label
          htmlFor="para-indent-toggle"
          style={{ ...LABEL_STYLE, marginBottom: 0, cursor: 'pointer' }}
        >
          First-line indent
        </label>
      </div>

      {/* ── Measure ───────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER_STYLE}>Measure</div>

      <NumberRow
        label="Line length"
        prop="--book-measure"
        min={2}
        max={8}
        step={0.25}
        defaultValue={4.5}
        unit="in"
        parse={(raw) => parseLengthValue(raw, 'in', 4.5)}
        format={(n) => `${n}in`}
      />

      {/* ── Margins ───────────────────────────────────────────────────────── */}
      <div style={SECTION_HEADER_STYLE}>Margins</div>

      <NumberRow
        label="Inside (spine)"
        prop="--book-margin-inside"
        min={0.25}
        max={2}
        step={0.0625}
        defaultValue={0.875}
        unit="in"
        parse={(raw) => parseLengthValue(raw, 'in', 0.875)}
        format={(n) => `${n}in`}
      />

      <NumberRow
        label="Outside (fore-edge)"
        prop="--book-margin-outside"
        min={0.25}
        max={2}
        step={0.0625}
        defaultValue={0.625}
        unit="in"
        parse={(raw) => parseLengthValue(raw, 'in', 0.625)}
        format={(n) => `${n}in`}
      />

      <NumberRow
        label="Top"
        prop="--book-margin-top"
        min={0.25}
        max={2}
        step={0.0625}
        defaultValue={0.75}
        unit="in"
        parse={(raw) => parseLengthValue(raw, 'in', 0.75)}
        format={(n) => `${n}in`}
      />

      <NumberRow
        label="Bottom"
        prop="--book-margin-bottom"
        min={0.25}
        max={2}
        step={0.0625}
        defaultValue={0.875}
        unit="in"
        parse={(raw) => parseLengthValue(raw, 'in', 0.875)}
        format={(n) => `${n}in`}
      />
    </div>
  );
}
