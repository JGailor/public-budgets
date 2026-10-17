import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Astro drops the line break between prose and an {expression} that starts the next line,
 * so "would start\n{date}" renders "would start" + "April 1" glued: "startApril 1". Shipped
 * three times in one story ("from2040-41", "onJune 23", "softenPolice"). Start the line with
 * a word instead, or end the previous line with {' '}.
 */
const root = join(import.meta.dirname, '../../src');
const astro = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? astro(join(dir, e.name)) : e.name.endsWith('.astro') ? [join(dir, e.name)] : []));

/** Template lines that start with a value expression right after a line ending in prose. */
export function gluedLines(src: string): number[] {
  const parts = src.split(/^---$/m);
  const template = parts.length >= 3 ? parts.slice(2).join('---') : src;
  const offset = parts.length >= 3 ? parts[0].split('\n').length + parts[1].split('\n').length : 0;
  const lines = template.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/g, (m) => m.replace(/[^\n]/g, '')).split('\n');
  const hits: number[] = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1]?.trimEnd() ?? '';
    const cur = l.trimStart();
    // prev ends in a word or punctuation that prose uses (not a tag, not an expression); cur opens a value expression.
    if (/[A-Za-z0-9,;:)'"’]$/.test(prev) && !/[>}]$/.test(prev) && /^\{(?!\/\*|' '\}|" "\})[^}]*\}(?!\s*$)/.test(cur) && !/=>|&&|\?/.test(cur.slice(0, cur.indexOf('}'))) && !/^\{\s*\w+:/.test(cur))
      hits.push(offset + i);
  });
  return hits;
}

describe('no prose glued to an expression at the start of a line', () => {
  it('detects the bug it names', () => {
    expect(gluedLines('---\nconst x = 1;\n---\n<p>\n  would start\n  {date}.\n</p>')).toHaveLength(1);
    expect(gluedLines('---\nconst x = 1;\n---\n<p>\n  would start {date}.\n</p>')).toHaveLength(0);
    expect(gluedLines("---\n---\n<p>\n  would start{' '}\n  {date}.\n</p>")).toHaveLength(0);
    // Object literals in a props array aren't text.
    expect(gluedLines("---\n---\n<X items={[\n  { href: '#a', label: 'A' },\n  { href: '#b', label: 'B' },\n]} />")).toHaveLength(0);
  });

  it('none in src', () => {
    const files = astro(root);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(gluedLines(readFileSync(f, 'utf8')), f.replace(root, 'src')).toEqual([]);
  });
});
