import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unwrapFigures } from './figures';

// #32: no small capitalized line above a heading, on any page; the facts they carried are said in words.
const dist = join(import.meta.dirname, '../../dist');
const pages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pages(join(dir, e.name)) : e.name === 'index.html' ? [join(dir, e.name)] : []));
const read = (path: string) => readFileSync(join(dist, path, 'index.html'), 'utf8');
const text = (path: string) =>
  unwrapFigures(read(path).replace(/<(script|style)[\s\S]*?<\/\1>/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

describe('no eyebrows (#32)', () => {
  it('no element on any page has class eyebrow or kicker', () => {
    const all = pages(dist);
    expect(all.length).toBeGreaterThan(8);
    const hits = all.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/class="(?:[^"]* )?(eyebrow|kicker)[ "]/g)].map((m) => `${f.slice(dist.length)}: ${m[1]}`));
    expect(hits).toEqual([]);
  });

  // Each fact an eyebrow carried, now in a heading or a first sentence.
  const B = '/us/ca/berkeley/';
  const facts: [string, RegExp][] = [
    [B, /<p class="lede">\s*Berkeley's whole budget for fiscal year 2027 is/],
    [`${B}gap/`, /<h1>The \$29 million gap in FY2027, step by step<\/h1>/],
    [`${B}gap/`, /<h2>The city plans to close it mostly with ongoing cuts of about 10%\.<\/h2>/],
    [`${B}revenue/`, /in General Fund revenue for FY2026/],
    [`${B}capital/`, /This page covers the program's FY2027-28 plan\./],
    [`${B}departments/`, /<h1>Who's being asked to cut in <span class="yr yr--fy2027"[^>]*>FY2027<\/span><span class="yr yr--fy2028"[^>]*>FY2028<\/span>, and by how much<\/h1>/],
    [`${B}departments/`, /Every department was asked to find savings in the proposed budget\./],
    [`${B}ballot/`, /<p class="lede"[^>]*>The election is November 3, 2026\./],
    [`${B}ballot/`, /It needs a simple majority to pass\./],
    [`${B}ballot/`, /It needs a two-thirds vote to pass\./],
  ];
  for (const [path, re] of facts) {
    it(`${path} still says ${re.source.replace(/\\/g, '').slice(0, 60)}`, () => {
      expect(read(path).replace(/ data-astro-cid-\w+/g, '').replace(/&#39;/g, "'")).toMatch(re);
    });
  }

  it('the source drawer is named by the document it shows', () => {
    const h = read(B);
    expect(h).toMatch(/<dialog class="receipt" aria-labelledby="receipt-heading"/);
    expect(text(B)).not.toMatch(/Source receipt/);
  });
});
