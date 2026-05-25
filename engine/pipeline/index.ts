/**
 * engine/pipeline — unified: parse → transform → HTML
 *
 * Converts a Markdown string (Pandoc-flavored) to HTML using:
 *   remark-parse → remark-frontmatter → remark-gfm → remark-directive
 *   → remark-math → remark-rehype → rehype-stringify
 *
 * Phase 0 stub — implementation coming in Task 2.
 */

export async function markdownToHtml(_markdown: string): Promise<string> {
  throw new Error('pipeline not yet implemented');
}
