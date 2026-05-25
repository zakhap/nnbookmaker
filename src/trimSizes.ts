export const CONCRETE_TRIM_SIZES = {
  '5x8':      { width: '127mm',   height: '203.2mm', label: '5 × 8 in (127 × 203mm)' },
  '5.5x8.5':  { width: '139.7mm', height: '215.9mm', label: '5.5 × 8.5 in (140 × 216mm)' },
  '6x9':      { width: '152.4mm', height: '228.6mm', label: '6 × 9 in (152 × 229mm)' },
  'a-format':  { width: '110mm',   height: '178mm',   label: 'A-format (110 × 178mm)' },
  'b-format':  { width: '130mm',   height: '198mm',   label: 'B-format (130 × 198mm)' },
  'demy':      { width: '138mm',   height: '216mm',   label: 'Demy (138 × 216mm)' },
  'royal':     { width: '156mm',   height: '234mm',   label: 'Royal (156 × 234mm)' },
  'crown':     { width: '189mm',   height: '246mm',   label: 'Crown Quarto (189 × 246mm)' },
} as const;

export type ConcreteTrimKey = keyof typeof CONCRETE_TRIM_SIZES;
export type TrimSizeKey = ConcreteTrimKey | 'custom';
export const DEFAULT_TRIM: TrimSizeKey = '6x9';

// Explicit rendering order for the select options
export const TRIM_SIZE_ORDER: TrimSizeKey[] = [
  '5x8', '5.5x8.5', '6x9', 'a-format', 'b-format', 'demy', 'royal', 'crown', 'custom'
];

// Labels for all keys (concrete + custom) for rendering
export const TRIM_SIZE_LABELS: Record<TrimSizeKey, string> = {
  ...Object.fromEntries(
    Object.entries(CONCRETE_TRIM_SIZES).map(([k, v]) => [k, v.label])
  ),
  custom: 'Custom…',
} as Record<TrimSizeKey, string>;
