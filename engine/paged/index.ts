/**
 * engine/paged — Paged.js preview integration (iframe host)
 *
 * Manages the isolated <iframe> that renders the paginated book.
 * Paged.js rewrites the DOM heavily; keeping it in an iframe prevents
 * reconciliation conflicts with React (per spec §3.6 / D-13).
 *
 * Phase 0 stub — implementation coming in Task 3.
 */

export function createPagedFrame(_container: HTMLElement): void {
  throw new Error('paged iframe host not yet implemented');
}
