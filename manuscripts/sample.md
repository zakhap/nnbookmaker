---
title: The Typographer's Companion
author: Ada Lovelace
isbn: 978-0-000-00000-0
trim: 6x9
theme: default
---

# Chapter One: Setting Type

Typography is the craft of endowing human language with a durable visual form.
Good typography is invisible to the reader — it serves the text, not itself.[^1]

## Basic Prose

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Small Caps and Emphasis

An acronym like :span[NASA]{.smallcaps} or :span[ISBN]{.smallcaps} should be set
in small capitals. You can also combine *italic* and **bold** inline with
:span[special-treatment]{.highlight} spans.

Note: remark-directive text-directive syntax is `:name[content]{attrs}`.
The `:span` name is used as a generic inline wrapper; the class is applied via
the `.className` shorthand in the attributes block.

## A Verse Block

The following poem uses a fenced directive for verse formatting:

:::verse

Whose woods these are I think I know.
His house is in the village though;
He will not see me stopping here
To watch his woods fill up with snow.

:::

## A Warning Callout

:::callout

**Note:** Directives let you attach arbitrary CSS classes to block-level
content. This callout should render as `<div class="callout">`.

:::

# Chapter Two: Tables and Data

## A Reference Table

| Trim size | Width  | Height | Pages (est.) |
| --------- | ------ | ------ | ------------ |
| 5×8       | 5 in   | 8 in   | 240          |
| 6×9       | 6 in   | 9 in   | 200          |
| 8.5×11    | 8.5 in | 11 in  | 140          |

Strikethrough text shows ~~deleted copy~~ mid-revision.

## Task List (GFM)

- [x] Parse frontmatter
- [x] Render headings
- [ ] Paginate with Paged.js
- [ ] Export PDF

# Chapter Three: Notes

Further reading is listed at the end of this manuscript.[^2]

[^1]: Robert Bringhurst, *The Elements of Typographic Style*, 4th ed.
[^2]: See the bibliography for a full list of sources.
