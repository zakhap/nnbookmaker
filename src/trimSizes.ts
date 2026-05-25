export const TRIM_SIZES = {
  '6x9': { width: '152.4mm', height: '228.6mm', label: '6 × 9 in (Trade)' },
  '5x8': { width: '127mm',   height: '203.2mm', label: '5 × 8 in (Trade)' },
} as const;

export type TrimSizeKey = keyof typeof TRIM_SIZES;
export const DEFAULT_TRIM: TrimSizeKey = '6x9';
