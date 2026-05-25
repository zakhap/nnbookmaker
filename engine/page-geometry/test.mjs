/**
 * engine/page-geometry/test.mjs
 *
 * Unit tests for generatePageCSS and generatePageGeometry.
 * Run with: node engine/page-geometry/test.mjs
 *   (after: tsc -p tsconfig.engine.json)
 *
 * Because the module uses getComputedStyle (a browser API), generatePageGeometry
 * is tested via a lightweight mock of the DOM interface.
 * generatePageCSS is tested directly with a plain PageGeometry object.
 */

import { generatePageCSS, readPageGeometry, generatePageGeometry } from '../../dist/engine/page-geometry/index.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Element whose getComputedStyle returns the given props.
 * We inject a global getComputedStyle that accepts this element.
 */
function makeRootMock(props) {
  const el = { _props: props };
  // Override global getComputedStyle for the duration of each test call.
  globalThis.getComputedStyle = (element) => ({
    getPropertyValue: (name) => element._props[name] ?? '',
  });
  return el;
}

// ── Test 1: generatePageCSS with explicit geometry ────────────────────────────

console.log('\n=== generatePageCSS (explicit geometry) ===');

const geometry6x9 = {
  width: '152.4mm',
  height: '228.6mm',
  marginTop: '19.05mm',
  marginBottom: '22.225mm',
  marginInside: '22.225mm',
  marginOutside: '15.875mm',
};

const css6x9 = generatePageCSS(geometry6x9);

assert(
  'contains @page rule',
  css6x9.includes('@page {')
);

assert(
  'size contains width and height',
  css6x9.includes('size: 152.4mm 228.6mm')
);

assert(
  'margin-top is set',
  css6x9.includes('margin-top: 19.05mm')
);

assert(
  'margin-bottom is set',
  css6x9.includes('margin-bottom: 22.225mm')
);

assert(
  'recto: margin-left = outside margin',
  css6x9.includes('margin-left: 15.875mm')
);

assert(
  'recto: margin-right = inside margin',
  css6x9.includes('margin-right: 22.225mm')
);

assert(
  'contains @page :left rule for verso',
  css6x9.includes('@page :left {')
);

assert(
  'verso: margin-left = inside (spine side for left pages)',
  // In :left rule, inside and outside swap
  css6x9.includes('@page :left') &&
    css6x9.split('@page :left')[1].includes('margin-left: 22.225mm')
);

assert(
  'does not contain var() references',
  !css6x9.includes('var(')
);

// ── Test 2: generatePageCSS with a different trim size ────────────────────────

console.log('\n=== generatePageCSS (5.5×8.5 in) ===');

const geometry55x85 = {
  width: '139.7mm',
  height: '215.9mm',
  marginTop: '19.05mm',
  marginBottom: '22.225mm',
  marginInside: '22.225mm',
  marginOutside: '15.875mm',
};

const css55x85 = generatePageCSS(geometry55x85);

assert(
  'size contains 5.5x8.5 dimensions',
  css55x85.includes('size: 139.7mm 215.9mm')
);

// ── Test 3: readPageGeometry uses getComputedStyle ────────────────────────────

console.log('\n=== readPageGeometry (mocked DOM) ===');

const mockRoot = makeRootMock({
  '--book-trim-width': '152.4mm',
  '--book-trim-height': '228.6mm',
  '--book-margin-top': '19.05mm',
  '--book-margin-bottom': '22.225mm',
  '--book-margin-inside': '22.225mm',
  '--book-margin-outside': '15.875mm',
});

const geom = readPageGeometry(mockRoot);

assert('width read from --book-trim-width', geom.width === '152.4mm');
assert('height read from --book-trim-height', geom.height === '228.6mm');
assert('marginTop read from --book-margin-top', geom.marginTop === '19.05mm');
assert('marginBottom read from --book-margin-bottom', geom.marginBottom === '22.225mm');
assert('marginInside read from --book-margin-inside', geom.marginInside === '22.225mm');
assert('marginOutside read from --book-margin-outside', geom.marginOutside === '15.875mm');

// ── Test 4: readPageGeometry falls back to defaults when props are missing ────

console.log('\n=== readPageGeometry (missing props → defaults) ===');

const emptyRoot = makeRootMock({});
const geomDefaults = readPageGeometry(emptyRoot);

assert('width defaults to 6in', geomDefaults.width === '6in');
assert('height defaults to 9in', geomDefaults.height === '9in');
assert('marginTop defaults to 0.75in', geomDefaults.marginTop === '0.75in');
assert('marginBottom defaults to 0.875in', geomDefaults.marginBottom === '0.875in');
assert('marginInside defaults to 0.875in', geomDefaults.marginInside === '0.875in');
assert('marginOutside defaults to 0.625in', geomDefaults.marginOutside === '0.625in');

// ── Test 5: generatePageGeometry end-to-end ───────────────────────────────────

console.log('\n=== generatePageGeometry (end-to-end) ===');

const fullMockRoot = makeRootMock({
  '--book-trim-width': '6in',
  '--book-trim-height': '9in',
  '--book-margin-top': '0.75in',
  '--book-margin-bottom': '0.875in',
  '--book-margin-inside': '0.875in',
  '--book-margin-outside': '0.625in',
});

const fullCSS = generatePageGeometry(fullMockRoot);

assert('returns a non-empty string', typeof fullCSS === 'string' && fullCSS.length > 0);
assert('size: 6in 9in', fullCSS.includes('size: 6in 9in'));
assert('margin-top: 0.75in', fullCSS.includes('margin-top: 0.75in'));
assert('no var() references in output', !fullCSS.includes('var('));

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`=== RESULTS: ${passed} passed, ${failed} failed ===`);

if (failed > 0) process.exit(1);
