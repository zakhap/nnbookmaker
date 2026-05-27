/**
 * TokenPanel — comprehensive live controls for book CSS design tokens.
 *
 * Sections: Type Scale · Fonts · Paragraph · Chapter (h1) · Section (h2) ·
 *   Subsection (h3) · Minor heads (h4–h6) · Heading style · Sub-body sizes ·
 *   Block spacing · Measure · Margins · Colors
 *
 * Every control is self-contained: it reads its initial value from the document
 * root via readCssProp() and writes back via setTokenOverride() + setProperty().
 * "Reset all" remounts every control (key={resetKey}) so they re-read CSS.
 */

import { useCallback, useState } from 'react';
import { useBookStore } from '../store.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCssProp(prop: string, fallback: string): string {
  const el = document.documentElement;
  const inline = el.style.getPropertyValue(prop).trim();
  if (inline) return inline;
  const computed = getComputedStyle(el).getPropertyValue(prop).trim();
  return computed || fallback;
}

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
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'system-ui, sans-serif',
  marginBottom: '6px',
  marginTop: '16px',
  paddingBottom: '4px',
  borderBottom: '1px solid #2a2a2a',
};

const ROW_STYLE: React.CSSProperties = {
  marginBottom: '8px',
};

// ─── Presets ──────────────────────────────────────────────────────────────────

const SCALE_RATIOS: Array<{ label: string; value: string }> = [
  { label: 'Minor Third — 1.200', value: '1.2' },
  { label: 'Major Third — 1.250', value: '1.25' },
  { label: 'Perfect Fourth — 1.333', value: '1.333' },
  { label: 'Augmented Fourth — 1.414', value: '1.414' },
  { label: 'Perfect Fifth — 1.500', value: '1.5' },
];

const GEORGIA = "Georgia, 'Palatino Linotype', 'Book Antiqua', Garamond, serif";

const SERIF_FONTS: Array<{ label: string; value: string }> = [
  { label: 'Georgia', value: GEORGIA },
  { label: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif" },
  { label: 'Garamond', value: "Garamond, 'EB Garamond', 'Cormorant Garamond', Palatino, serif" },
  { label: 'Times New Roman', value: "'Times New Roman', Times, Georgia, serif" },
  { label: 'Baskerville', value: "Baskerville, 'Baskerville Old Face', 'Hoefler Text', Georgia, serif" },
  { label: 'Book Antiqua', value: "'Book Antiqua', 'Palatino Linotype', Palatino, Georgia, serif" },
  { label: 'Caslon', value: "'Adobe Caslon Pro', 'Big Caslon', 'Book Antiqua', serif" },
];

const MONO_FONTS: Array<{ label: string; value: string }> = [
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
  { label: 'Menlo / Monaco', value: "Menlo, Monaco, 'Courier New', monospace" },
  { label: 'Consolas', value: "Consolas, 'Courier New', monospace" },
  { label: 'Lucida Console', value: "'Lucida Console', 'DejaVu Sans Mono', 'Courier New', monospace" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  prop: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  displayUnit?: string;
  displayFormat?: (n: number) => string;
  parse?: (raw: string) => number;
  format?: (n: number) => string;
}

function SliderRow({
  label, prop, min, max, step, defaultValue,
  displayUnit = '', displayFormat, parse, format,
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

  const displayValue = displayFormat
    ? displayFormat(value)
    : displayUnit
      ? `${value}${displayUnit}`
      : String(value);

  return (
    <div style={ROW_STYLE}>
      <div style={LABEL_STYLE}>
        <span>{label}</span>
        <span style={{ color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>{displayValue}</span>
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
  parse?: (raw: string) => number;
  format: (n: number) => string;
}

function NumberRow({ label, prop, min, max, step, defaultValue, unit, parse, format }: NumberRowProps) {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);
  const rawDefault = readCssProp(prop, `${defaultValue}${unit}`);
  const parsedDefault = parse ? parse(rawDefault) : parseLengthValue(rawDefault, unit, defaultValue);
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

interface SelectRowProps {
  label: string;
  prop: string;
  options: Array<{ label: string; value: string }>;
  defaultValue: string;
}

function SelectRow({ label, prop, options, defaultValue }: SelectRowProps) {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);
  const raw = readCssProp(prop, defaultValue);
  const matched = options.find((o) => o.value === raw)?.value ?? defaultValue;
  const [value, setValue] = useState<string>(matched);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setValue(v);
      document.documentElement.style.setProperty(prop, v);
      setTokenOverride(prop, v);
    },
    [prop, setTokenOverride]
  );

  return (
    <div style={ROW_STYLE}>
      <div style={LABEL_STYLE}><span>{label}</span></div>
      <select value={value} onChange={handleChange} style={SELECT_STYLE} aria-label={label}>
        {options.map(({ label: l, value: v }) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  prop: string;
  defaultValue: string;
}

function ColorRow({ label, prop, defaultValue }: ColorRowProps) {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);
  const initial = readCssProp(prop, defaultValue) || defaultValue;
  const [value, setValue] = useState<string>(initial);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      document.documentElement.style.setProperty(prop, v);
      setTokenOverride(prop, v);
    },
    [prop, setTokenOverride]
  );

  return (
    <div style={{ ...ROW_STYLE, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        type="color"
        value={value}
        onChange={handleChange}
        style={{
          width: '28px', height: '22px', border: '1px solid #444',
          borderRadius: '3px', cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
        aria-label={label}
      />
      <span style={{ fontSize: '11px', color: '#aaa', fontFamily: 'system-ui, sans-serif', flex: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function IndentToggle() {
  const setTokenOverride = useBookStore((s) => s.setTokenOverride);
  const removeTokenOverride = useBookStore((s) => s.removeTokenOverride);
  const raw = readCssProp('--book-para-indent', '1');
  const [checked, setChecked] = useState<boolean>(
    raw !== '0' && raw !== '0em' && raw !== ''
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const on = e.target.checked;
      setChecked(on);
      if (on) {
        document.documentElement.style.removeProperty('--book-para-indent');
        removeTokenOverride('--book-para-indent');
      } else {
        document.documentElement.style.setProperty('--book-para-indent', '0');
        setTokenOverride('--book-para-indent', '0');
      }
    },
    [setTokenOverride, removeTokenOverride]
  );

  return (
    <div style={{ ...ROW_STYLE, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        id="para-indent-toggle"
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        style={{ accentColor: '#888', cursor: 'pointer' }}
      />
      <label
        htmlFor="para-indent-toggle"
        style={{ ...LABEL_STYLE, marginBottom: 0, cursor: 'pointer', flex: 1 }}
      >
        First-line indent
      </label>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TokenPanel() {
  const resetTokenOverrides = useBookStore((s) => s.resetTokenOverrides);
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    resetTokenOverrides();
    setResetKey((k) => k + 1);
  }, [resetTokenOverrides]);

  if (!open) {
    return (
      <button
        type="button"
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
        width: '260px',
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
          marginBottom: '4px',
          borderBottom: '1px solid #333',
          paddingBottom: '8px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          Design Tokens
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              fontSize: '10px',
              padding: '2px 7px',
              background: '#2a2a2a',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
            title="Reset all tokens to defaults"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
            aria-label="Close token panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* All controls — key forces remount + CSS re-read on reset */}
      <div key={resetKey}>

        {/* ── Type Scale ───────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Type Scale</div>

        <SliderRow
          label="Base size"
          prop="--pt-base"
          min={8} max={18} step={0.5}
          defaultValue={11}
          displayUnit="pt"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="Leading ratio"
          prop="--leading-ratio"
          min={1.1} max={2.0} step={0.01}
          defaultValue={1.272727}
          displayFormat={(n) => n.toFixed(3)}
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SelectRow
          label="Scale ratio"
          prop="--scale-ratio"
          options={SCALE_RATIOS}
          defaultValue="1.333"
        />

        {/* ── Fonts ────────────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Fonts</div>

        <SelectRow
          label="Body typeface"
          prop="--font-body"
          options={SERIF_FONTS}
          defaultValue={GEORGIA}
        />
        <SelectRow
          label="Heading typeface"
          prop="--font-heading"
          options={SERIF_FONTS}
          defaultValue={GEORGIA}
        />
        <SelectRow
          label="Monospace"
          prop="--font-mono"
          options={MONO_FONTS}
          defaultValue="'Courier New', Courier, monospace"
        />

        {/* ── Paragraph ────────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Paragraph</div>

        <IndentToggle />
        <SliderRow
          label="Indent width"
          prop="--indent-ratio"
          min={0.5} max={5} step={0.25}
          defaultValue={2}
          displayFormat={(n) => `${n}×`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Chapter (h1) ─────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Chapter — h1</div>

        <SliderRow
          label="Drop before"
          prop="--rhythm-chapter-before"
          min={0} max={14} step={1}
          defaultValue={6}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="Space after"
          prop="--rhythm-chapter-after"
          min={0} max={8} step={1}
          defaultValue={3}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Section (h2) ─────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Section — h2</div>

        <SliderRow
          label="Space before"
          prop="--rhythm-h2-before"
          min={0} max={10} step={1}
          defaultValue={3}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="Space after"
          prop="--rhythm-h2-after"
          min={0} max={6} step={1}
          defaultValue={1}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Subsection (h3) ──────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Subsection — h3</div>

        <SliderRow
          label="Space before"
          prop="--rhythm-h3-before"
          min={0} max={8} step={1}
          defaultValue={2}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="Space after"
          prop="--rhythm-h3-after"
          min={0} max={4} step={1}
          defaultValue={0}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Minor heads (h4–h6) ──────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Minor heads — h4–h6</div>

        <SliderRow
          label="h4 before"
          prop="--rhythm-h4-before"
          min={0} max={6} step={1}
          defaultValue={2}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="h5 before"
          prop="--rhythm-h5-before"
          min={0} max={4} step={1}
          defaultValue={1}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="h6 before"
          prop="--rhythm-h6-before"
          min={0} max={4} step={1}
          defaultValue={1}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Heading style ─────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Heading Style</div>

        <SliderRow
          label="Tracking"
          prop="--heading-tracking"
          min={-0.05} max={0.1} step={0.005}
          defaultValue={-0.01}
          displayFormat={(n) => `${n >= 0 ? '+' : ''}${(n * 1000).toFixed(0)}/1000em`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => `${n.toFixed(3)}em`}
        />
        <SliderRow
          label="Small-caps tracking"
          prop="--smallcaps-tracking"
          min={0} max={0.15} step={0.005}
          defaultValue={0.06}
          displayFormat={(n) => `+${(n * 1000).toFixed(0)}/1000em`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => `${n.toFixed(3)}em`}
        />

        {/* ── Sub-body sizes ────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Sub-body Sizes</div>

        <SliderRow
          label="Extract (blockquote)"
          prop="--extract-ratio"
          min={0.70} max={1.00} step={0.005}
          defaultValue={0.927}
          displayFormat={(n) => `${(n * 100).toFixed(0)}%`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => n.toFixed(3)}
        />
        <SliderRow
          label="Caption"
          prop="--caption-ratio"
          min={0.70} max={1.00} step={0.005}
          defaultValue={0.864}
          displayFormat={(n) => `${(n * 100).toFixed(0)}%`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => n.toFixed(3)}
        />
        <SliderRow
          label="Footnote"
          prop="--footnote-ratio"
          min={0.65} max={1.00} step={0.005}
          defaultValue={0.818}
          displayFormat={(n) => `${(n * 100).toFixed(0)}%`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => n.toFixed(3)}
        />
        <SliderRow
          label="Code / mono"
          prop="--code-ratio"
          min={0.70} max={1.00} step={0.005}
          defaultValue={0.864}
          displayFormat={(n) => `${(n * 100).toFixed(0)}%`}
          parse={(raw) => parseFloat(raw)}
          format={(n) => n.toFixed(3)}
        />

        {/* ── Block spacing ──────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Block Spacing</div>

        <SliderRow
          label="Before (blockquote, table…)"
          prop="--rhythm-block-before"
          min={0} max={4} step={0.5}
          defaultValue={1}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="After"
          prop="--rhythm-block-after"
          min={0} max={4} step={0.5}
          defaultValue={1}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />
        <SliderRow
          label="Indent left"
          prop="--rhythm-block-indent-left"
          min={0} max={8} step={0.5}
          defaultValue={3}
          displayUnit="×"
          parse={(raw) => parseFloat(raw)}
          format={(n) => String(n)}
        />

        {/* ── Measure ────────────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Measure</div>

        <NumberRow
          label="Line length"
          prop="--book-measure"
          min={2} max={8} step={0.25}
          defaultValue={4.5}
          unit="in"
          parse={(raw) => parseLengthValue(raw, 'in', 4.5)}
          format={(n) => `${n}in`}
        />

        {/* ── Margins ────────────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Margins</div>

        <NumberRow
          label="Inside (spine)"
          prop="--book-margin-inside"
          min={0.25} max={2} step={0.0625}
          defaultValue={0.875}
          unit="in"
          parse={(raw) => parseLengthValue(raw, 'in', 0.875)}
          format={(n) => `${n}in`}
        />
        <NumberRow
          label="Outside (fore-edge)"
          prop="--book-margin-outside"
          min={0.25} max={2} step={0.0625}
          defaultValue={0.625}
          unit="in"
          parse={(raw) => parseLengthValue(raw, 'in', 0.625)}
          format={(n) => `${n}in`}
        />
        <NumberRow
          label="Top"
          prop="--book-margin-top"
          min={0.25} max={2} step={0.0625}
          defaultValue={0.75}
          unit="in"
          parse={(raw) => parseLengthValue(raw, 'in', 0.75)}
          format={(n) => `${n}in`}
        />
        <NumberRow
          label="Bottom"
          prop="--book-margin-bottom"
          min={0.25} max={2} step={0.0625}
          defaultValue={0.875}
          unit="in"
          parse={(raw) => parseLengthValue(raw, 'in', 0.875)}
          format={(n) => `${n}in`}
        />

        {/* ── Colors ─────────────────────────────────────────────────────────── */}
        <div style={SECTION_HEADER_STYLE}>Colors</div>

        <ColorRow label="Ink"    prop="--book-color-ink"    defaultValue="#1a1a18" />
        <ColorRow label="Paper"  prop="--book-color-paper"  defaultValue="#fffff8" />
        <ColorRow label="Accent" prop="--book-color-accent" defaultValue="#5a4632" />
        <ColorRow label="Rule"   prop="--book-color-rule"   defaultValue="#c8c4bc" />

        {/* Bottom padding so last items aren't flush against edge */}
        <div style={{ height: '16px' }} />
      </div>
    </div>
  );
}
