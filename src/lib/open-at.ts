/**
 * Where a receipt's link opens a document (#30): a PDF at the page the quote is on
 * (#page=N, the open parameter Chrome, Edge and Firefox's viewers follow); anything
 * else as is. It doesn't promise a highlight: viewers can't reliably jump to a phrase.
 * No imports, so the drawer's browser script can use it as well as the build.
 */
export function openAt(source: { url: string; format: string }, page?: number): { href: string; label: string } {
  if (source.format !== 'PDF') return { href: source.url, label: 'Open the source ↗' };
  if (!page) return { href: source.url, label: 'Open the PDF ↗' };
  return { href: `${source.url}#page=${page}`, label: `Open the PDF at page ${page} ↗` };
}
