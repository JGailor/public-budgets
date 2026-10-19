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

/**
 * Template lines that start with a value expression, or an inline component (a figure
 * that opens its receipt, a glossary term), right after a line ending in prose. Astro
 * drops the line break before either, gluing the words: "chart shows the$283.8M" (#29).
 */
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
    const prose = /[A-Za-z0-9,;:)'"’]$/.test(prev) && !/[>}]$/.test(prev);
    const expression = /^\{(?!\/\*|' '\}|" "\})[^}]*\}(?!\s*$)/.test(cur) && !/=>|&&|\?/.test(cur.slice(0, cur.indexOf('}'))) && !/^\{\s*\w+:/.test(cur);
    const inline = /^<(Sourced|Term)\b/.test(cur);
    if (prose && (expression || inline)) hits.push(offset + i);
    // …and the other way round: an inline component closes a line and prose starts the next ("8%a year").
    if (/<\/(Sourced|Term)>$/.test(prev) && /^[A-Za-z0-9(]/.test(cur)) hits.push(offset + i);
    // …or one inline component right after another, across the break ("$313.8MGeneral Fund").
    if ((/<\/(Sourced|Term)>$/.test(prev) || /^>$/.test(prev.trim())) && inline) hits.push(offset + i);
  });
  return hits;
}

describe('no prose glued to an expression at the start of a line', () => {
  it('detects the bug it names', () => {
    expect(gluedLines('---\nconst x = 1;\n---\n<p>\n  would start\n  {date}.\n</p>')).toHaveLength(1);
    expect(gluedLines('---\nconst x = 1;\n---\n<p>\n  would start {date}.\n</p>')).toHaveLength(0);
    expect(gluedLines("---\n---\n<p>\n  would start{' '}\n  {date}.\n</p>")).toHaveLength(0);
    // An inline figure or term on its own line glues the same way (#29).
    expect(gluedLines('---\n---\n<p>\n  This chart shows the\n  <Sourced city={city} figure={f}>$283.8M</Sourced> of it.\n</p>')).toHaveLength(1);
    expect(gluedLines('---\n---\n<p>\n  the\n  <Term city={city} name="X">X</Term>\n</p>')).toHaveLength(1);
    expect(gluedLines('---\n---\n<p>\n  about <Sourced city={city} figure={f}>8%</Sourced>\n  a year.\n</p>')).toHaveLength(1);
    expect(gluedLines('---\n---\n<p>\n  about <Sourced city={city} figure={f}>8%</Sourced>,\n  a year.\n</p>')).toHaveLength(0);
    expect(gluedLines('---\n---\n<p>\n  The <Sourced city={city} figure={f}\n    >$313.8M</Sourced\n  >\n  <Term city={city} name="GF">General Fund</Term> is\n</p>')).toHaveLength(1);
    // Object literals in a props array aren't text.
    expect(gluedLines("---\n---\n<X items={[\n  { href: '#a', label: 'A' },\n  { href: '#b', label: 'B' },\n]} />")).toHaveLength(0);
  });

  it('none in src', () => {
    const files = astro(root);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(gluedLines(readFileSync(f, 'utf8')), f.replace(root, 'src')).toEqual([]);
  });
});
