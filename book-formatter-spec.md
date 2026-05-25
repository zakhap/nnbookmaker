# Product Spec — Markdown-Native Book Typesetting Tool

**Working name:** TBD
**Status:** Draft v0.1 (for internal review)
**Audience:** Power users — web-native designers and book setters at a small press, building for themselves
**Primary deliverable:** Print-ready PDF for a commercial printer. EPUB export is minimal/secondary.

---

## 1. Vision

A browser-based tool that turns a Markdown manuscript into a typeset book, previewed live across real trim sizes and exported as a press-grade PDF. Markdown is the source of truth because it keeps writing close to thinking while quietly enforcing structure. Layout, formatting, and design are expressed entirely in **CSS** — programmatically, through a comprehensive design-token system, with a clean escape hatch for custom CSS overrides.

The product is a **typesetting instrument for power users**, not a consumer "make a book" wizard. It should expose the full depth of web-based typography and never paper over it.

---

## 2. Goals & non-goals

### Goals
- Author/import a Markdown file and see it paginated into a real book, live.
- Preview across standard book trim sizes (and custom sizes).
- Drive all layout from CSS custom properties organized as a token hierarchy.
- Allow arbitrary custom CSS that reliably overrides defaults without specificity fights.
- Export a print-ready PDF suitable for a commercial printer (bleed, crop marks, eventually CMYK/PDF-X).
- Keep the door open to footnotes, references, image anchoring, multi-file projects, and EPUB — without designing them out now.

### Non-goals (for now)
- WYSIWYG drag-and-drop layout. Layout is code.
- Real-time multi-user collaboration.
- A large library of pre-baked consumer themes.
- Full EPUB feature parity. EPUB is a minimal export, not a first-class target.

---

## 3. Core architectural decisions

These are the load-bearing choices. Everything else follows from them.

### 3.1 Two renderers, one stylesheet
Layout fidelity comes from the browser's CSS render tree, so the **preview** renders client-side. But a press PDF needs production features the browser print path can't emit — CMYK color, PDF/X conformance, proper TrimBox/BleedBox, font-embedding control. So the architecture treats rendering as **two consumers of the same HTML + token CSS**:

| Stage | Renderer | Runs | Output |
|---|---|---|---|
| Live preview | **Paged.js** (MIT polyfill) | Client, in-browser | On-screen paginated pages |
| Press export | **Vivliostyle CLI** or **Prince** | Server / headless (fast-follow) | Print-grade PDF |

The stylesheet must stay **engine-portable** — no engine-specific hacks in the token layer. Engine quirks live in thin adapter stylesheets.

### 3.2 Engine choice & rationale
- **Paged.js** — MIT-licensed, drops in as a polyfill, trivial to embed for live preview, well-known in the book-design community, actively being rebuilt (the `<paged-page>` web component is part of a 2025+ "next chapter" effort). **Use for preview.**
- **Vivliostyle** — more actively advancing CSS support (recent releases added `initial-letter`/drop caps, extended `nth-*` selectors, `@font-face` improvements; core is at 2.39.x in early 2026), with a strong headless CLI. **License is AGPL-3.0** — fine for an internal tool, a real decision if ever hosted publicly. **Candidate for press export.**
- **Prince (PrinceXML)** — commercial, the long-standing gold standard for HTML→print PDF, best-in-class footnotes/H&J. Paid license. **Alternative press-export engine if budget allows.**

Decision: **Paged.js for preview now; evaluate Vivliostyle CLI vs Prince for export in the export phase.** Keep both reachable from day one by not coupling to either.

### 3.3 The token cascade uses `@layer`
The design-token hierarchy is expressed with native CSS cascade layers, in priority order:

```
@layer primitives, global, semantic, components, overrides;
```

`overrides` wins over everything below it regardless of selector specificity — which is exactly how user/custom CSS injection should behave. No `!important` arms race.

### 3.4 `var()` does not work reliably inside `@page`
Custom properties do **not** dependably cascade into `@page` descriptors (`size`, `margin`) or the margin boxes across paged engines. Strategy: **tokens are the source of truth; page geometry is generated from them at render time** by reading the custom properties in JS and writing the `@page` block (or mirroring literal values). This is isolated in a single "page-geometry generator" module.

### 3.5 Baseline grid is enforced, not native
CSS has no baseline grid. Vertical rhythm is enforced by making every vertical measurement a `calc()` multiple of one `--book-baseline` unit. This is a hard rule in the component layer.

### 3.6 The rendered book is isolated from the app's DOM
The paged engine mutates the DOM heavily (chunking content into pages). A virtual-DOM framework will fight it. **Render the book inside an `<iframe>` (or a framework-excluded container)** so the app shell and the paginated document never reconcile against each other. This also sandboxes user custom CSS.

---

## 4. Tech stack ("best of the best", pragmatic)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Non-negotiable for a tool with this many moving structural parts. |
| Build/dev server | **Vite** | Fast HMR; the live-preview loop depends on it. |
| App framework | **React** (Svelte/Solid acceptable) | Ecosystem; framework matters little since the book renders in an isolated frame. |
| Editor | **CodeMirror 6** | Lighter and more Markdown-friendly than Monaco; good mobile/touch story; easy custom syntax highlighting for our Markdown extensions. |
| Markdown pipeline | **unified** (`remark-parse`, `remark-gfm`, `remark-directive`, `remark-math`, `remark-rehype`, `rehype-*`) | Implements the Pandoc-compatible *conventions* client-side without shipping a binary. `remark-directive` gives us fenced divs/spans for styling hooks and image anchoring. |
| (later) Full Pandoc | **Pandoc (wasm or server)** | Swap in for full-fidelity citations/CSL when needed; the AST conventions already match. |
| Footnotes/refs | `remark` footnotes now; **CSL** + `citeproc-js` for references later | CSL is the publishing-world standard (Zotero, Pandoc). |
| Styling/tokens | **Native CSS custom properties + `@layer`** (PostCSS in build only) | The token system *is* the product; no CSS framework. |
| Preview engine | **Paged.js** | See 3.2. |
| Export engine (fast-follow) | **Vivliostyle CLI** or **Prince** | See 3.2. |
| PDF post-processing (fast-follow) | **Ghostscript** | RGB→CMYK, PDF/X-1a/X-4 conversion, ICC profiles. |
| Fonts | `@font-face`; `fontkit`/`opentype.js` to inspect; `subset-font`/`glyphhanger` to subset | Embedding + subsetting control for print. |
| State | **Zustand** (or equivalent) | Holds manuscript, token values, custom CSS, project config. |
| Export service (fast-follow) | **Node service** wrapping the export engine + Ghostscript | Headless render farm for press PDFs. |

---

## 5. Content model (Markdown)

### 5.1 Syntax baseline
Adopt **Pandoc Markdown conventions** as the authoring contract:
- YAML **frontmatter** for metadata: `title`, `author`, `isbn`, `trim`, `theme`, etc.
- Footnotes: `[^1]` (the established Pandoc/Markdown-Extra syntax — do not invent).
- **Fenced divs / spans with attributes** for styling hooks: `::: {.verse}` … `:::`, `[small caps]{.smallcaps}`. Implemented via `remark-directive`.
- Figures with captions.

### 5.2 The one custom convention worth designing: image anchoring
"An image associated with a certain line of text" is the non-standard piece. Proposed approach (to be finalized): a directive that anchors an asset to a position with a placement mode, e.g.

```
::: {.figure anchor="after" placement="full-bleed"}
![Alt text](assets/plate-01.jpg)
Caption text.
:::
```

Placement modes map to CSS layout strategies: `column` (in text measure), `margin` (marginalia column), `full-bleed` (extends past trim), `float-top`/`float-bottom` (page-relative). Anchoring + pagination interaction is genuinely hard and is scoped as **fast-follow**, but the syntax is reserved now so authoring doesn't have to change later.

### 5.3 Multi-file
MVP is **single file**. Fast-follow adds a project manifest (ordered list of Markdown files + shared assets + theme), with stitching at render time.

---

## 6. Feature breakdown

### 6.1 MVP — prove the core loop
The MVP exists to prove: *Markdown in → live paginated book across real trim sizes → token-driven CSS → proofing PDF out.*

- Single `.md` input (paste or upload), with frontmatter parsing.
- unified pipeline → HTML with our class/attribute hooks.
- Paged.js live preview in an isolated frame; edit → repaginate.
- **Trim-size selector** with real book sizes (5×8, 5.5×8.5, 6×9, A/B-format, Demy, Royal, Crown…) + custom size.
- **Token panel**: live controls for the core CSS custom properties (trim, margins incl. inside/outside, base size, leading, measure, type scale ratio, paragraph model).
- Default theme (one good, complete token set).
- **Custom CSS injection** into the `overrides` layer.
- Footnotes — simplest viable (endnotes or basic Paged.js footnotes; placement quality deferred).
- Export: **browser-generated PDF** (proofing-grade, RGB) — good enough to read and check, not yet press-ready.
- Recto/verso-aware margins in the model (even if preview shows single pages first).

### 6.2 Fast-follows (in rough priority order)
1. **Press-grade PDF export** — server render via Vivliostyle CLI/Prince: bleed, crop marks, TrimBox/BleedBox.
2. **CMYK / PDF-X pipeline** — Ghostscript post-process with ICC profiles; printer-profile presets.
3. **True footnote placement** — bottom-of-page, same page as reference.
4. **Image anchoring** — implement §5.2 placement modes.
5. **Spread / recto-verso preview** — two-page spreads, mirrored margins, running heads that flip.
6. **Multi-file projects** — manifest + stitching + asset management.
7. **Theme save/load** — named token sets, import/export.
8. **Baseline-grid overlay** — visual debugging of vertical rhythm.
9. **Advanced typography UI** — drop caps (`initial-letter`), OpenType feature toggles, hyphenation/H&J controls, hanging punctuation, small caps.
10. **Front-matter generators** — title page, copyright page, auto **TOC** with leader dots.

### 6.3 Later / vision
- EPUB export (minimal, reflowable).
- CSL references/bibliography via `citeproc-js`.
- Marginalia / sidenotes.
- Better H&J via hyphenation dictionaries.
- Plugin system for custom Paged.js/Vivliostyle handlers.
- Versioning; eventually collaboration.
- Full Pandoc (wasm/server) swap-in for fidelity.

---

## 7. Build plan (phased)

### Phase 0 — De-risk spike (≈1–2 weeks)
Prove the riskiest integrations before committing to UI:
- unified pipeline rendering Pandoc-flavored Markdown → HTML.
- Paged.js paginating that HTML inside an isolated iframe.
- Live reload: edit text → repaginate without losing scroll/page position.
- `@page` geometry generated from custom properties (validate the §3.4 workaround).
**Exit criteria:** a hard-coded manuscript repaginates live at two trim sizes, driven by CSS variables.

### Phase 1 — MVP (the core loop)
- CodeMirror editor + frontmatter.
- Token panel wired to the `@layer` token sheet.
- Trim-size selector with real sizes.
- Custom CSS injection (overrides layer).
- Basic footnotes.
- Proofing PDF export (browser).
**Exit criteria:** a real manuscript is authored, restyled via tokens + custom CSS, and exported as a readable proofing PDF.

### Phase 2 — Press export
- Export service wrapping Vivliostyle CLI/Prince.
- Bleed, crop marks, page boxes.
- Ghostscript CMYK/PDF-X conversion + printer presets.
**Exit criteria:** a PDF that a commercial printer accepts.

### Phase 3 — Projects & deep typography
- Multi-file manifest + stitching + assets.
- True footnote placement; image anchoring.
- Spread/recto-verso preview.
- Advanced typography controls; TOC + front matter; theme save/load.

---

## 8. Open questions / risks

- **Export engine:** Vivliostyle CLI (AGPL, free, actively advancing) vs Prince (commercial, best footnotes/H&J). Resolve in Phase 2 with a head-to-head on a real title.
- **AGPL exposure:** acceptable for an internal tool? Changes the calculus if this is ever hosted for outside authors.
- **Footnote fidelity vs effort:** how good do footnotes need to be for MVP vs Phase 3?
- **Performance at book length:** Paged.js repagination cost on a 300-page manuscript — may need incremental/region repagination, or preview-by-chapter.
- **Font licensing:** print embedding rights for the faces the press uses.
- **Pandoc fidelity ceiling:** how far the unified subset goes before a real Pandoc swap-in is forced (likely driven by citations).
- **Image anchoring semantics:** finalize the directive + placement model before authors create content that depends on it.

---

## 9. Decision log & rationale

This section preserves the reasoning behind the choices above, the alternatives we rejected, corrections we made along the way, and the point-in-time research that informed the engine pick. It's the "why," kept separate from the "what" so the spec body stays lean.

### 9.1 Decision records

Each entry: what we chose, what we passed on, why, and how settled it is.

**D-01 — Markdown is the source of truth.** Chose Markdown over a rich-text/WYSIWYG editor. Markdown keeps authoring close to writing while quietly imposing document structure (headings, lists, notes) that maps cleanly to typeset elements. WYSIWYG was rejected as a non-goal — layout is code here. *Settled.*

**D-02 — Adopt Pandoc conventions; don't invent a Markdown standard.** The initial idea included defining "an MD standard" for footnotes, references, and image anchoring. We rejected inventing one because Pandoc Markdown is already the publishing lingua franca and ships the hard parts: `[^1]` footnotes, CSL/BibTeX citations, fenced divs/spans with attributes (perfect styling hooks), figures, YAML frontmatter. We implement the Pandoc-compatible *conventions* client-side via the unified/remark ecosystem now, and keep a real Pandoc (wasm/server) as a later swap-in for full fidelity. The **one** convention we do define ourselves is image anchoring (§5.2), because nothing standard covers "image tied to a line with a placement mode." *Settled, except the anchoring syntax which is reserved but not finalized.*

**D-03 — Print-first, PDF-primary.** Press-ready PDF is the primary deliverable; EPUB is a minimal, secondary export. This drives fixed pagination over reflow and lets us optimize for one target. *Settled.*

**D-04 — Preview renders client-side.** Chosen over server-side rendering for the preview loop. (See D-05 for the fidelity nuance that made this safe.) *Settled for now; export is the exception.*

**D-05 — Two renderers, one stylesheet.** This emerged from a correction (§9.2). Rather than "client = fast, server = high fidelity," we split by *concern*: client-side Paged.js for preview (same render tree = same layout), server/headless engine for the press PDF (production features the browser can't emit). Both consume the identical token CSS; engine quirks are quarantined in thin adapters. *Settled as the architecture; export engine TBD (see D-06, open).*

**D-06 — Paged.js for preview; Vivliostyle CLI or Prince for export.** For preview, Paged.js won on license (MIT) and trivial embeddability. For export, the choice between Vivliostyle CLI (free, AGPL, actively advancing) and Prince (commercial, best-in-class footnotes/H&J) is deferred to a Phase 2 head-to-head. Evidence in §9.3. *Preview settled; export open.*

**D-07 — Real book trim sizes, not the ISO A-series.** The original sketch listed A4/A3/A6/A2. We corrected this: A-series are office/poster sizes (A2 is poster-scale) and almost no trade books use them. The selector ships real trade sizes (5×8, 5.5×8.5, 6×9, A/B-format, Demy, Royal, Crown) plus custom dimensions. *Settled.*

**D-08 — All formatting via CSS, driven by a design-token hierarchy.** A founding premise, kept. Three sub-decisions fell out of it: (a) express the token tiers as `@layer primitives, global, semantic, components, overrides` so injected custom CSS wins without specificity fights; (b) generate `@page` geometry from tokens in JS because `var()` is unreliable inside `@page`; (c) enforce a baseline grid manually via `calc()` multiples of one baseline unit, since CSS has none natively. *Settled.* (Full token sheet delivered separately.)

**D-09 — Footnotes: easiest viable first, don't preclude depth.** Explicit instruction. MVP uses the simplest path (endnotes or basic Paged.js footnotes); true bottom-of-page placement — a genuinely hard layout problem — is a fast-follow. The constraint is that nothing in the MVP design forecloses the harder version later. *Settled as a sequencing decision.*

**D-10 — Single file first, stitch later.** MVP takes one `.md` file. Multi-file projects (manifest + ordered files + shared assets) are a fast-follow. *Settled.*

**D-11 — Audience: power users building for themselves.** Web-native designers and book setters at the press. This justifies the non-goals — no WYSIWYG, no consumer theme gallery, no hand-holding — and the decision to expose typographic depth rather than hide it. *Settled.*

**D-12 — Editor: CodeMirror 6 over Monaco.** Lighter, better Markdown/touch story, easier to teach our custom syntax. *Settled, low stakes.*

**D-13 — Isolate the rendered book in an iframe.** The paged engine rewrites the DOM to chunk pages; a virtual-DOM framework would fight it. Rendering the book in an iframe (or framework-excluded container) keeps app shell and document from reconciling against each other, and sandboxes user CSS. *Settled.*

**D-14 — TypeScript + Vite; React acceptable but low-stakes.** TS for structural safety, Vite for the HMR-driven preview loop. The app framework matters little because the book renders in isolation. *Settled.*

### 9.2 Corrections & clarifications made during design

These reframed the work and are worth remembering:

- **A-series sizing (→ D-07).** The trim sizes in the original idea were office/poster formats, not book formats. Corrected to real trade sizes.
- **"Why does server-side mean higher fidelity if we share the DOM + CSS render tree?"** This pushback was correct, and it improved the architecture. Layout fidelity *does* come from the shared render tree — Paged.js uses the browser's own layout engine, so a client-side page lays out identically to a headless-browser page. The real gap is **PDF production**, not layout: CMYK color and PDF/X conformance (browsers emit RGB only), TrimBox/BleedBox for bleed and crop marks, and font embedding/subsetting control. That distinction is exactly what produced the two-renderer model (D-05) instead of a vague "server is better" assumption.

### 9.3 Engine research (point-in-time, ~May 2026)

Captured as evidence for D-06. These are living projects; re-verify before locking the export engine.

- **Paged.js** — MIT-licensed; a polyfill for the W3C Paged Media and Generated Content modules. A May 2025 post introduced a "next chapter" rebuild, with repo activity continuing into Jan 2026 and a new `<paged-page>` web component factored out for reuse. Easy to embed as a script. Sources: pagedjs.org, github.com/pagedjs.
- **Vivliostyle** — AGPL-3.0 (both vivliostyle.js and the CLI). The more actively *advancing* engine: core at 2.39.x in early 2026, with the CLI/viewer/VFM all committed to through ~May 2026. Recent releases added typeset-relevant CSS: `initial-letter` (drop caps), extended `nth-*` selectors, `@font-face` improvements, and CSS text-spacing. Ships a headless CLI (PDF build) plus a browser viewer. Their own Markdown flavor is VFM — we're standardizing on Pandoc conventions instead, so we'd use Vivliostyle purely as a renderer. The AGPL network-copyleft clause is the watch-item if this is ever publicly hosted. Sources: github.com/vivliostyle, vivliostyle-cli changelog.
- **Prince (PrinceXML)** — commercial, long the gold standard for HTML→print PDF with strong footnote and H&J handling. Paid license. (General knowledge, not re-verified this session — confirm current pricing/licensing before committing.)

---

## 10. Appendix — suggested repo shape

```
/app            # editor shell, token panel, trim selector (React + Vite)
/engine
  /pipeline     # unified: parse → transform → HTML
  /paged        # Paged.js preview integration (iframe host)
  /page-geometry# generates @page from tokens (the §3.4 module)
/tokens
  primitives.css
  global.css
  semantic.css
  components.css
  overrides.css # (empty; user CSS target)
/themes         # named token sets (Phase 3)
/export         # Node service: Vivliostyle/Prince + Ghostscript (Phase 2)
/manuscripts    # sample books for testing
```
