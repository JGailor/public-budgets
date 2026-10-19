import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityBudget } from '../../src/data/types';
import { unwrapFigures } from './figures';

const root = join(import.meta.dirname, '../..');
const b: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));
const groups = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/revenue-groups.json'), 'utf8')).groups as { id: string; name: string; lines: string[] }[];
const html = readFileSync(join(root, 'dist/us/ca/berkeley/revenue/index.html'), 'utf8');
const text = unwrapFigures(html).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const line = (n: string) => b.revenue.lines.find((l) => l.name === n)!;

describe('revenue page (built)', () => {
  it('property tax groups to 33%', () => {
    const g = groups.find((x) => x.id === 'property-tax')!;
    const share = g.lines.reduce((a, n) => a + line(n).fy2026Adopted, 0) / b.revenue.total.fy2026Adopted;
    expect(Math.round(share * 100)).toBe(33);
    expect(text).toMatch(new RegExp(`Property tax ${Math.round(share * 100)}%`));
  });

  it('Business License Tax 10% received; Transfers +797%', () => {
    const blt = line('Business License Tax');
    const tr = line('Transfers');
    expect(text).toMatch(new RegExp(`Business License Tax \\$[\\d.]+M .*?${Math.round((blt.fy2026MidYearActual / blt.fy2026Adopted) * 100)}%`));
    const change = Math.round(((tr.fy2026MidYearActual - tr.fy2025MidYearActual) / tr.fy2025MidYearActual) * 100);
    expect(change).toBe(797);
    expect(text).toContain(`+${change}%`);
  });

  it('has all 24 line items, each budget figure its own receipt (#29)', () => {
    const lines = [...html.matchAll(/<li class="line"[\s\S]*?<\/li>/g)].map((m) => m[0]);
    expect(lines).toHaveLength(b.revenue.lines.length);
    for (const l of lines) expect(l).toMatch(/<span class="l-budget"[^>]*>\s*<span class="num"[^>]*><button[^>]*class="sourced/);
  });

  it('the insight cards quote the data', () => {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const tt = line('Property Transfer Tax');
    const mp = line('Property Transfer Tax — Measure P');
    expect(text).toContain(`receipts were up ${pct((tt.fy2026MidYearActual - tt.fy2025MidYearActual) / tt.fy2025MidYearActual)} on last year`);
    expect(text).toContain(`Measure P share was up ${pct((mp.fy2026MidYearActual - mp.fy2025MidYearActual) / mp.fy2025MidYearActual)}`);
    const tr = line('Transfers');
    expect(text).toContain(`rose from $${(tr.fy2025MidYearActual / 1e6).toFixed(1)}M to $${(tr.fy2026MidYearActual / 1e6).toFixed(1)}M at mid-year`);
  });
});
