/**
 * engine/pipeline — unified: parse → transform → HTML
 *
 * Converts a Markdown string to HTML using:
 *   remark-parse → remark-frontmatter → remark-gfm → remark-directive
 *   → remark-math → remark-rehype → rehype-stringify
 *
 * Returns both the HTML string and the parsed frontmatter object.
 *
 * ── Directive syntax note ──────────────────────────────────────────────────────
 * The spec design doc references Pandoc span syntax `[text]{.class}` and fenced
 * div syntax `:::{.verse}`, but this tool uses remark-directive syntax instead:
 *
 *   - Inline spans:  `:span[text]{.class}`    (remark-directive textDirective)
 *   - Leaf blocks:   `::name{.class}`          (remark-directive leafDirective)
 *   - Container divs: `:::name` or `:::name{.extra-class}`
 *                                              (remark-directive containerDirective)
 *
 * This is a deliberate choice — remark-directive is the authoring contract for
 * this tool. Pandoc syntax is NOT supported.
 */

import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  html: string;
  frontmatter: Record<string, unknown>;
}

// ─── Minimal YAML key-value parser ───────────────────────────────────────────
// Handles the simple flat key: value pairs used in book frontmatter.
// Not a full YAML parser — complex values fall back to raw strings.

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim();
    // Unquote string literals
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      result[key] = value.slice(1, -1);
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (value !== '' && !isNaN(Number(value)) && isFinite(Number(value))) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Directive → HTML plugin ──────────────────────────────────────────────────
// remark-directive parses :::fenced and [span]{.class} into mdast nodes but
// does NOT produce HTML on its own.  This plugin wires those nodes to hast
// by setting data.hName / data.hProperties so remark-rehype picks them up.

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string> | null;
  data?: Record<string, unknown>;
};

function remarkDirectiveToHtml() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(
      tree,
      [
        'containerDirective',
        'leafDirective',
        'textDirective',
      ] as string[],
      (node) => {
        const n = node as unknown as DirectiveNode;
        if (!n.data) n.data = {};

        const isInline = n.type === 'textDirective';
        const tagName = isInline ? 'span' : 'div';

        // Build hProperties from directive attributes.
        // Directive attribute syntax:  {.className #id key=value}
        const attrs = n.attributes ?? {};
        const hProps: Record<string, unknown> = {};

        // className: directive name is the first class unless it's the same as the
        // tag name (i.e. the generic :span wrapper), followed by any .foo attrs.
        // e.g. :::verse             → class="verse"
        //      :::callout{.warning} → class="callout warning"
        //      :span[text]{.small}  → class="small"   (name "span" == tag, skip)
        const classes: string[] = n.name !== tagName ? [n.name] : [];
        if (attrs['class']) {
          classes.push(...String(attrs['class']).split(/\s+/));
        }
        if (classes.length > 0) {
          hProps['className'] = classes;
        }

        // id
        if (attrs['id']) {
          hProps['id'] = attrs['id'];
        }
        // remaining attrs (data-*, aria-*, etc.)
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'class' || k === 'id') continue;
          hProps[k] = v;
        }

        n.data.hName = tagName;
        n.data.hProperties = hProps;
      }
    );
  };
}

// ─── Frontmatter extraction plugin ───────────────────────────────────────────

type YamlNode = {
  type: 'yaml';
  value: string;
};

function remarkExtractFrontmatter(
  store: { matter: Record<string, unknown> }
) {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'yaml', (node) => {
      const n = node as unknown as YamlNode;
      store.matter = parseSimpleYaml(n.value);
    });
  };
}

// ─── Base processor (module-scoped, frozen) ───────────────────────────────────
// Contains only the stateless remark-phase plugins (parse + pure transforms).
// Frozen so unified can cache the parse/validate work.
//
// NOTE: remarkRehype and rehypeStringify are intentionally NOT in the base —
// they would move the tree to hast before the per-call fork plugins run,
// making it impossible for fork plugins to see mdast nodes (yaml, directives).
// The fork appends plugins at the END of the transform chain, so any plugin
// added via fork().use() after a remark→hast bridge sees only hast nodes.

const _baseProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkMath)
  .freeze();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a Markdown string through the full unified pipeline and return
 * both the rendered HTML and the parsed YAML frontmatter.
 *
 * Forks the frozen base processor on each call and appends:
 *   1. remarkExtractFrontmatter — reads yaml nodes (mdast phase, stateful)
 *   2. remarkDirectiveToHtml    — wires directive nodes to hast (mdast phase)
 *   3. remarkRehype             — converts mdast → hast
 *   4. rehypeStringify          — serialises hast → HTML string
 *
 * The remark→rehype bridge must come AFTER the stateful mdast plugins so those
 * plugins see the original mdast tree, not the converted hast tree.
 * safe: allowDangerousHtml — manuscript is trusted author input.
 */
export async function parseMd(markdown: string): Promise<PipelineResult> {
  const store: { matter: Record<string, unknown> } = { matter: {} };

  const file = await _baseProcessor()
    .use(remarkExtractFrontmatter, store)
    .use(remarkDirectiveToHtml)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return {
    html: String(file),
    frontmatter: store.matter,
  };
}

/**
 * Legacy alias kept for backwards compatibility with any callers using
 * the old stub signature.  Prefer parseMd() for new code.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { html } = await parseMd(markdown);
  return html;
}
