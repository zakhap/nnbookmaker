/**
 * engine/pipeline/test.mjs
 *
 * Quick smoke-test for the parseMd pipeline.
 * Run with:  node engine/pipeline/test.mjs
 *
 * Checks:
 *  1. frontmatter is extracted (not rendered as content)
 *  2. fenced directives produce elements with class attributes
 *  3. span directives produce <span class="…">
 *  4. footnotes render
 *  5. tables render
 */

import { readFileSync } from 'node:fs';
import { parseMd } from '../../dist/engine/pipeline/index.js';

const sample = readFileSync(
  new URL('../../manuscripts/sample.md', import.meta.url),
  'utf8'
);

const { html, frontmatter } = await parseMd(sample);

// ── Print results ─────────────────────────────────────────────────────────────

console.log('=== FRONTMATTER ===');
console.log(JSON.stringify(frontmatter, null, 2));
console.log('');

// ── Assertions ────────────────────────────────────────────────────────────────

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

console.log('=== ASSERTIONS ===');

// 1. Frontmatter extracted
assert(
  'frontmatter.title is "The Typographer\'s Companion"',
  frontmatter.title === "The Typographer's Companion"
);
assert('frontmatter.author is "Ada Lovelace"', frontmatter.author === 'Ada Lovelace');
assert('frontmatter.trim is "6x9"', frontmatter.trim === '6x9');
assert('frontmatter.isbn is present', typeof frontmatter.isbn === 'string');

// 2. Frontmatter NOT in HTML output
assert(
  'YAML frontmatter block not rendered into HTML',
  !html.includes('isbn:') && !html.includes('trim:')
);

// 3. Fenced directive :::verse → <div class="verse">
assert(':::verse renders to <div class="verse">', html.includes('class="verse"'));

// 4. Fenced directive :::callout → <div class="callout">
assert(':::callout renders to <div class="callout">', html.includes('class="callout"'));

// 5. Span directive :span[NASA]{.smallcaps} → <span class="smallcaps">
assert(
  ':span[NASA]{.smallcaps} renders to <span class="smallcaps">',
  html.includes('class="smallcaps"')
);

// 6. Footnotes rendered
// remark-gfm produces:
//   inline: <sup><a href="#user-content-fn-1" id="user-content-fnref-1"
//              data-footnote-ref ...>1</a></sup>
//   endnotes: <section data-footnotes class="footnotes">
//               <h2 class="sr-only" id="footnote-label">Footnotes</h2>
//               <ol><li id="user-content-fn-1">…</li></ol>
//             </section>
assert(
  'Footnote call site: data-footnote-ref attribute present',
  html.includes('data-footnote-ref')
);
assert(
  'Footnote endnote section: <section class="footnotes"> present',
  html.includes('class="footnotes"')
);
assert(
  'Footnote endnote section: sr-only heading for accessibility',
  html.includes('class="sr-only"') && html.includes('id="footnote-label"')
);
assert(
  'Footnote endnote list item: user-content-fn-1 anchor',
  html.includes('id="user-content-fn-1"')
);
assert(
  'Footnote back-reference: data-footnote-backref link present',
  html.includes('data-footnote-backref')
);

// 7. Table rendered
assert('Table renders to <table>', html.includes('<table>'));

// 8. Strikethrough (GFM)
assert('GFM strikethrough renders to <del>', html.includes('<del>'));

// 9. Headings present
assert('H1 rendered', html.includes('<h1>'));
assert('H2 rendered', html.includes('<h2>'));

console.log('');
console.log(`=== RESULTS: ${passed} passed, ${failed} failed ===`);

// ── HTML snippet ──────────────────────────────────────────────────────────────

console.log('');
console.log('=== HTML SNIPPET (first 2000 chars) ===');
console.log(html.slice(0, 2000));

if (failed > 0) process.exit(1);
