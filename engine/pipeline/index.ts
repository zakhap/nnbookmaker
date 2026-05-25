/**
 * engine/pipeline — unified: parse → transform → HTML
 *
 * Converts a Markdown string (Pandoc-flavored) to HTML using:
 *   remark-parse → remark-frontmatter → remark-gfm → remark-directive
 *   → remark-math → remark-rehype → rehype-stringify
 *
 * Returns both the HTML string and the parsed frontmatter object.
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
    } else if (value !== '' && !isNaN(Number(value))) {
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

        // class attribute (from .foo syntax, stored as "class" key)
        if (attrs['class']) {
          hProps['className'] = String(attrs['class']).split(/\s+/);
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

        // Also use the directive name as a class if no class was given
        // e.g. :::verse  →  <div class="verse">
        if (!attrs['class'] && n.name) {
          hProps['className'] = [n.name];
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a Markdown string through the full unified pipeline and return
 * both the rendered HTML and the parsed YAML frontmatter.
 */
export async function parseMd(markdown: string): Promise<PipelineResult> {
  const frontmatterStore: { matter: Record<string, unknown> } = {
    matter: {},
  };

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkExtractFrontmatter, frontmatterStore)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkDirectiveToHtml)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const file = await processor.process(markdown);

  return {
    html: String(file),
    frontmatter: frontmatterStore.matter,
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
