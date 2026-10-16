import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityBudget } from '../../src/data/types';

const root = join(import.meta.dirname, '../..');
const b: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));
const html = readFileSync(join(root, 'dist/us/ca/berkeley/ballot/index.html'), 'utf8');
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const cards = [...html.matchAll(/<li class="card scenario"[^>]*data-outcome="(passes|fails)"[^>]*>([\s\S]*?)<\/li>\s*(?=<li class="card scenario"|<\/ul>)/g)].map((m) => ({
  outcome: m[1],
  html: m[2],
  text: strip(m[2]),
}));

describe('ballot page (built)', () => {
  it('has exactly two scenario cards, passes then fails', () => {
    expect(cards.map((c) => c.outcome)).toEqual(['passes', 'fails']);
  });

  it('passes 105 positions (85 vacant, 20 filled), FTE 1,455; fails 138 (100 / 38), FTE 1,422', () => {
    const pos = (k: string) => b.fte.positions.find((p) => p.key === k)!;
    const fte = (k: string) => Math.round(b.fte.scenarios.find((s) => s.key === k)!.fy2027NetFte).toLocaleString('en-US');
    const [passes, fails] = cards;
    const w = pos('with-sales-tax');
    const wo = pos('without-sales-tax');
    expect([w.total, w.vacant, w.filled, fte('with-sales-tax')]).toEqual([105, 85, 20, '1,455']);
    expect([wo.total, wo.vacant, wo.filled, fte('without-sales-tax')]).toEqual([138, 100, 38, '1,422']);
    expect(passes.text).toContain(`${w.total} positions eliminated ${w.vacant} vacant · ${w.filled} filled (layoffs)`);
    expect(passes.text).toContain(`${fte('with-sales-tax')} FTE`);
    expect(fails.text).toContain(`${wo.total} positions eliminated ${wo.vacant} vacant · ${wo.filled} filled (layoffs)`);
    expect(fails.text).toContain(`${fte('without-sales-tax')} FTE`);
  });

  it('the pictograms are drawn to one scale, filled to the layoff counts', () => {
    const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;
    for (const c of cards) expect(count(c.html, /class="person[ "]/g)).toBe(40);
    expect(count(cards[0].html, /class="person on/g)).toBe(20);
    expect(count(cards[1].html, /class="person on/g)).toBe(38);
  });

  it('both cards have the same markup apart from their numbers and words', () => {
    const skeleton = (h: string) =>
      h
        .replace(/data-receipt="[^"]*"/g, '')
        .replace(/aria-label="[^"]*"/g, '')
        .replace(/>[^<]*</g, '><')
        .replace(/class="person on/g, 'class="person')
        // The fire-station line cites one source if it passes and two if it fails.
        .replace(/(<span class="chips"[\s\S]*?<\/span><\/span>)+/g, 'CHIPS');
    expect(skeleton(cards[0].html)).toBe(skeleton(cards[1].html));
  });

  it('uses no advocacy language', () => {
    expect(strip(html)).not.toMatch(/vote (yes|no)\b|devastat|catastroph|disastr|must pass/i);
  });
});
