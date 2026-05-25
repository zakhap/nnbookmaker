/**
 * TrimSizeSelector — dropdown for choosing a book trim size.
 *
 * Renders a <select> populated from TRIM_SIZES. When 'custom' is selected,
 * two numeric inputs appear for width and height (in mm). Changes are written
 * to the Zustand store; App.tsx useLayoutEffect applies them to CSS tokens.
 */

import { useBookStore } from '../store.ts';
import { TRIM_SIZE_LABELS, TRIM_SIZE_ORDER, TrimSizeKey } from '../trimSizes.ts';

const SELECT_STYLE: React.CSSProperties = {
  fontSize: '12px',
  padding: '2px 6px',
  border: '1px solid #ccc',
  borderRadius: '3px',
  background: 'white',
  cursor: 'pointer',
};

const NUMBER_INPUT_STYLE: React.CSSProperties = {
  fontSize: '12px',
  padding: '2px 4px',
  border: '1px solid #ccc',
  borderRadius: '3px',
  background: 'white',
  width: '56px',
  textAlign: 'right',
};

export default function TrimSizeSelector() {
  const trimSize = useBookStore((s) => s.trimSize);
  const setTrimSize = useBookStore((s) => s.setTrimSize);
  const customTrimWidth = useBookStore((s) => s.customTrimWidth);
  const customTrimHeight = useBookStore((s) => s.customTrimHeight);
  const setCustomTrim = useBookStore((s) => s.setCustomTrim);

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontWeight: 500 }}>Trim:</span>

      <select
        value={trimSize}
        onChange={(e) => setTrimSize(e.target.value as TrimSizeKey)}
        style={SELECT_STYLE}
      >
        {TRIM_SIZE_ORDER.map((key) => (
          <option key={key} value={key}>
            {TRIM_SIZE_LABELS[key]}
          </option>
        ))}
      </select>

      {trimSize === 'custom' && (
        <>
          <input
            type="number"
            min={50}
            max={400}
            step={0.5}
            value={customTrimWidth}
            onChange={(e) => setCustomTrim(e.target.value, customTrimHeight)}
            placeholder="W mm"
            aria-label="Custom trim width in mm"
            style={NUMBER_INPUT_STYLE}
          />
          <span aria-hidden="true" style={{ color: '#888' }}>×</span>
          <input
            type="number"
            min={50}
            max={600}
            step={0.5}
            value={customTrimHeight}
            onChange={(e) => setCustomTrim(customTrimWidth, e.target.value)}
            placeholder="H mm"
            aria-label="Custom trim height in mm"
            style={NUMBER_INPUT_STYLE}
          />
          <span aria-hidden="true" style={{ color: '#888', fontSize: '11px' }}>mm</span>
        </>
      )}
    </label>
  );
}
