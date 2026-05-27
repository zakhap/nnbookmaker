---
title: The Typographer's Companion
author: Ada Lovelace
isbn: 978-0-000-00000-0
trim: 6x9
theme: default
---

# Chapter One: Setting Type

Typography is the craft of endowing human language with a durable visual form.
Good typography is invisible to the reader — it serves the text, not itself.[^bringhurst]

## The Body Text Baseline

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
culpa qui officia deserunt mollit anim id est laborum.

## Inline Emphasis

An acronym like :span[NASA]{.smallcaps} or :span[ISBN]{.smallcaps} should be set
in small capitals. Text can be *italic*, **bold**, or ***bold and italic***
together. Strikethrough shows ~~deleted copy~~ mid-revision, and `inline code`
uses a monospace face.

Em dashes — like this — and en dashes mark ranges such as pages 12–34. A
well-set book uses curly quotes: "like these" and 'these'.

### Small Caps and Tracking

Small capitals set :span[BC]{.smallcaps} and :span[AD]{.smallcaps} dates
correctly. The tracking on small caps is a separate token from heading tracking,
letting you tune each context independently.

#### Optical Size and Weight

At display sizes, type benefits from tighter tracking. At caption sizes, slightly
looser tracking improves legibility. The design token system encodes these
corrections rather than leaving them to guesswork.[^tschichold]

##### Running Matter

Running heads and folios use the footnote-size token. They appear outside the
text block and do not disrupt the baseline grid.

###### Marginal Notes

At the smallest heading level, content collapses visually into the body.
:span[H6]{.smallcaps} is rarely used in trade book typography — it exists
primarily for technical manuals and reference works.

## A Verse Block

:::verse

Whose woods these are I think I know.
His house is in the village though;
He will not see me stopping here
To watch his woods fill up with snow.

My little horse must think it queer
To stop without a farmhouse near
Between the woods and frozen lake
The darkest evening of the year.

:::

## Callouts and Extracts

:::callout

**Note:** Directives let you attach arbitrary :span[CSS]{.smallcaps} classes
to block-level content. This callout renders as a tinted aside — useful for
warnings, tips, or editorial notes.

:::

The following uses a blockquote for a short pull-quote:

> The reader we assume is educated, intelligent, and busy. The book must reward
> that investment.
>
> — Jan Tschichold, *The Form of the Book*

For longer quotations that should be visually offset, use an extract div instead
of a plain blockquote:

:::extract

The typographer's first duty is to the reader. Set the type so that a person
reading alone, in silence, receives the message as if in direct conversation with
the author. That economy of means — that invisibility of method — is the measure
of success.

:::

# Chapter Two: Structure and Hierarchy

Hierarchy is the grammar of the page. Without it, readers cannot navigate;
with it, they glide.

## Numbered and Bulleted Lists

An ordered list of typographic priorities:

1. Legibility — can individual letters be distinguished?
2. Readability — can the text be read comfortably over long stretches?
3. Hierarchy — can the reader quickly scan for structure?
4. Color — does the text block carry appropriate visual weight?

An unordered list of common type classifications:

- Serif
  - Old Style (Garamond, Caslon)
  - Transitional (Baskerville, Times New Roman)
  - Modern (Bodoni, Didot)
- Sans-serif
  - Grotesque (Helvetica, Akzidenz-Grotesk)
  - Geometric (Futura, Gill Sans)
  - Humanist (Optima, Stone Serif)
- Monospace
  - Slab-serif (Courier)
  - Linear (Menlo, Consolas)

## Task List

- [x] Parse :span[YAML]{.smallcaps} frontmatter
- [x] Render headings h1–h6
- [x] Render inline formatting (bold, italic, small caps)
- [x] Paginate with Paged.js
- [ ] Export to :span[PDF]{.smallcaps} via `pagedjs-cli`
- [ ] Support right-to-left scripts

# Chapter Three: Tables and Data

## A Reference Table

| Trim size | Width  | Height | Typical pages |
| :-------- | -----: | -----: | ------------: |
| 5×8       | 5 in   | 8 in   | 240           |
| 6×9       | 6 in   | 9 in   | 200           |
| 7×10      | 7 in   | 10 in  | 160           |
| 8.5×11    | 8.5 in | 11 in  | 140           |

:span[GFM]{.smallcaps} table alignment is set per column in the separator row.
The left column is left-aligned; the remaining columns are right-aligned.

## Mathematical Matter

Inline math uses dollar-sign delimiters: $E = mc^2$. Display math sits on its
own line and is centred on the text block:

$$
\frac{d}{dx}\left(\int_a^x f(t)\,dt\right) = f(x)
$$

Math rendering requires a KaTeX or MathJax pass; the pipeline parses and marks
the nodes but does not evaluate them by default.

# Chapter Four: Code and Technical Matter

## Inline and Block Code

Inline code references tokens like `--font-base-size` or function names like
`parseMd()`. Fenced blocks show larger examples with syntax highlighting:

```css
@layer overrides {
  :root {
    --pt-base: 12;
    --scale-ratio: 1.25;
    --font-body: 'Garamond', Georgia, serif;
  }
}
```

```typescript
export async function parseMd(md: string): Promise<PipelineResult> {
  const store: { matter: Record<string, unknown> } = { matter: {} };
  const file = await _baseProcessor()
    .use(remarkExtractFrontmatter, store)
    .use(remarkDirectiveToHtml)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return { html: String(file), frontmatter: store.matter };
}
```

A horizontal rule marks a section break when a heading would be too heavy:

---

Short prose after a rule picks up the thread without introducing a new heading.

## Leaf Directives

A leaf directive sits on its own line and produces a self-closing element.
The following inserts a decorative ornament between sections:

::ornament

Content resumes below the ornament as normal paragraph text.

# Chapter Five: Notes and Reference

A manuscript may accumulate footnotes[^footnotes] across many chapters. Paged.js
collects them at the foot of each page; endnotes require a separate rendering
pass and a different directive.

Further reading appears at the end of each chapter or in a terminal bibliography.
The footnote-size and footnote-leading tokens govern how densely they may be set.

[^bringhurst]: Robert Bringhurst, *The Elements of Typographic Style*, 4th ed.
(Hartley & Marks, 2004), p. 17.

[^tschichold]: Jan Tschichold, *The Form of the Book* (Hartley & Marks, 1991).

[^footnotes]: Footnotes use the `--footnote-size` and `--footnote-leading` tokens
and are separated from the text block by a short rule governed by `--rhythm-footnote-gap`.
