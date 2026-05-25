# Themes

A theme is a JSON file that declares a named set of token overrides. Applying a theme means writing its `tokens` values into the CSS custom properties on `:root` — identical to what the token panel does when a user drags a slider.

## File format

```json
{
  "$schema": "../themes/schema.json",
  "name": "My Theme",
  "description": "One-line description shown in the theme picker.",
  "version": "1",

  "tokens": {
    "primitives": {
      "--pt-base": "11",
      "--leading-ratio": "1.272727"
    },
    "global": {
      "--book-trim-width": "152.4mm",
      "--book-color-ink": "#1a1a18"
    }
  }
}
```

### Rules

- Only `primitives` and `global` layer tokens belong in a theme file. The `semantic` and `components` layers derive their values through `calc()` chains from these two layers — overriding primitives/globals propagates automatically.
- Every key must be a valid CSS custom property name (starts with `--`).
- Values are strings, exactly as you would write them in a CSS declaration.
- Omitting a token means "keep the default". A theme does not need to be exhaustive — partial overrides are valid.
- The `version` field is reserved for future migration tooling; always write `"1"` for now.

## Available primitive tokens

| Token | Default | Meaning |
|---|---|---|
| `--pt-base` | `11` | Body text size in points (unitless; used in `calc(N * 1pt)`) |
| `--leading-ratio` | `1.272727` | Leading ÷ body size (14/11 = one 14pt baseline per line) |
| `--scale-ratio` | `1.333` | Heading type scale — Perfect Fourth |
| `--indent-ratio` | `2` | First-line indent as a multiple of `--pt-base` |
| `--heading-tracking` | `-0.01em` | Letter-spacing on all headings |
| `--smallcaps-tracking` | `0.06em` | Letter-spacing on small-caps text |
| `--rhythm-chapter-before` | `6` | Baselines of space above h1 |
| `--rhythm-chapter-after` | `3` | Baselines of space below h1 |
| `--rhythm-h2-before` | `3` | Baselines above h2 |
| `--rhythm-h2-after` | `1` | Baselines below h2 |
| `--rhythm-h3-before` | `2` | Baselines above h3 |
| `--rhythm-h4-before` | `2` | Baselines above h4 |
| `--rhythm-h5-before` | `1` | Baselines above h5 |
| `--rhythm-h6-before` | `1` | Baselines above h6 |
| `--rhythm-block-before` | `1` | Baselines above block elements |
| `--rhythm-block-after` | `1` | Baselines below block elements |
| `--rhythm-footnote-gap` | `1` | Baselines between footnote rule and first note |

## Available global tokens

| Token | Default | Meaning |
|---|---|---|
| `--book-trim-width` | `152.4mm` | Page trim width (6 in) |
| `--book-trim-height` | `228.6mm` | Page trim height (9 in) |
| `--book-margin-top` | `0.75in` | Top page margin |
| `--book-margin-bottom` | `0.875in` | Bottom page margin |
| `--book-margin-inside` | `0.875in` | Spine/gutter margin |
| `--book-margin-outside` | `0.625in` | Fore-edge margin |
| `--book-color-ink` | `#1a1a18` | Body text colour |
| `--book-color-paper` | `#fffff8` | Page background colour |
| `--book-color-rule` | `#c8c4bc` | Horizontal rules and borders |
| `--book-color-accent` | `#5a4632` | Drop caps, ornamental elements |
| `--font-base-family` | `Georgia, …, serif` | Body and heading font stack |
| `--font-heading-family` | `Georgia, …, serif` | Heading font stack (may differ) |
| `--font-mono-family` | `'Courier New', …, monospace` | Code/pre font stack |

## Seeded themes

| File | Description |
|---|---|
| `default.json` | Standard US trade book — the zero-state for every new manuscript |
