import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityBudget } from '../../src/data/types';

// Recomputes every figure on the landing page straight from budget.json, without the
// site's helpers, and checks the built page shows it.
const root = join(import.meta.dirname, '../..');
const b: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
// Text only: markup can split a phrase, which would make a missing-text check pass by accident.
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/ ([,.])/g, '$1');
const millions = (n: number) => `$${(Math.abs(n) / 1e6).toFixed(1)}M`;

describe('landing page numbers trace to the data', () => {
  const depts = b.departmentReductions.find((y) => y.year === 'FY2027')!.departments;

  it('the headline and the gap in the subhead (#28)', () => {
    const gap = b.deficitBridge.steps.find((s) => s.key === 'final-gap')!.fy2027;
    expect(text).toContain("Berkeley's costs keep growing faster than its income.");
    // The gap's chip sits right after it, so its label is in the text: "gap S1, closed".
    expect(text).toContain(`This year that's a ${millions(gap)} gap S1, closed with cuts, one-time money and, if voters approve it, a sales tax.`);
  });

  it('the cut sections stay cut: no stats strip, no How it works, no path line, no eyebrows (#28)', () => {
    for (const gone of ['department spending, mapped', 'numbers without a receipt', 'How it works', 'Keep the receipt', 'wherethemoneywent.com / us', 'Free · Independent'])
      expect(text).not.toContain(gone);
    // The receipt drawer's own label is shared by every page; #32 handles it.
    expect(html.replace(/<dialog[\s\S]*?<\/dialog>/g, '')).not.toContain('class="eyebrow"');
  });

  it('Police and Fire per $100, by largest remainder', () => {
    const total = depts.reduce((a, d) => a + d.baseline, 0);
    const exact = depts.map((d) => ({ id: d.id, v: (d.baseline / total) * 100 }));
    const whole = new Map(exact.map((e) => [e.id, Math.floor(e.v)]));
    let left = 100 - [...whole.values()].reduce((a, n) => a + n, 0);
    for (const e of [...exact].sort((x, y) => (y.v % 1) - (x.v % 1))) if (left-- > 0) whole.set(e.id, whole.get(e.id)! + 1);
    expect(text).toContain(`Police and Fire are $${whole.get('police')! + whole.get('fire')!} of every $100.`);
  });

  it('the gap', () => {
    const gap = b.deficitBridge.steps.find((s) => s.key === 'final-gap')!.fy2027;
    expect(text).toContain(`A ${millions(gap)} gap after adjustments.`);
  });

  it('positions cut with and without the sales tax', () => {
    const p = Object.fromEntries(b.fte.positions.map((x) => [x.key, x.vacant + x.filled]));
    expect(text).toContain(`${p['with-sales-tax']} positions cut instead of ${p['without-sales-tax']}.`);
  });

  it('who is cutting what', () => {
    const cut = depts.filter((d) => d.reduction > 0);
    expect(text).toContain(`${millions(cut.reduce((a, d) => a + d.reduction, 0))} across ${cut.length} departments.`);
  });

  it('every one of those figures has a source chip', () => {
    expect((html.match(/data-source-chip=/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });
});

describe('landing page sharing and requests', () => {
  const meta = (prop: string) => html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1];

  it('has the title, canonical URL and link-preview tags', () => {
    expect(html).toContain('<title>Where the Money Went</title>');
    expect(html).toContain('<link rel="canonical" href="https://wherethemoneywent.com/">');
    expect(meta('og:url')).toBe('https://wherethemoneywent.com/');
    expect(meta('og:image')).toBe('https://wherethemoneywent.com/og/wherethemoneywent.png');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('description')).toMatch(/^Your city's budget, finally readable\./);
  });

  it('ships a 1200×630 link-preview image', () => {
    const png = readFileSync(join(root, 'dist/og/wherethemoneywent.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('"Request your city" opens the request-a-city issue form', () => {
    expect(html).toMatch(/<form[^>]*action="https:\/\/github\.com\/JGailor\/public-budgets\/issues\/new"[^>]*method="get"/);
    expect(html).toContain('name="template" value="request-a-city.yml"');
  });
});
