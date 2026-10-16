import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityBudget } from '../../src/data/types';

// The story's checks, recomputed from budget.json without the site's helpers.
const root = join(import.meta.dirname, '../..');
const b: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));
const html = readFileSync(join(root, 'dist/us/ca/berkeley/index.html'), 'utf8');
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/ ([,.])/g, '$1');
const depts = b.departmentReductions.find((y) => y.year === 'FY2027')!.departments;
const total = depts.reduce((a, d) => a + d.baseline, 0);

describe('overview checks', () => {
  it('Police = 37 squares and "$37.42 of every $100"', () => {
    const police = depts.find((d) => d.id === 'police')!;
    const exact = ((police.baseline / total) * 100).toFixed(2);
    expect(exact).toBe('37.42');
    expect(html.match(/class="sq" data-dept="police"/g)).toHaveLength(37);
    expect(html).toContain(`aria-label="Police: $${exact} of every $100"`);
    expect(text).toContain(`$${exact} of every $100`);
  });

  it('the waffle has exactly 100 squares', () => {
    expect(html.match(/class="sq" data-dept=/g)).toHaveLength(100);
  });

  it('families $57 / $22 / $17 / $4 in the legend', () => {
    expect(text).toMatch(/Public safety \$57 .*People & places \$22 .*Running the city \$17 .*Oversight & elected \$4/);
  });

  it('the gap shows $29.2M', () => {
    const gap = b.deficitBridge.steps.find((s) => s.key === 'final-gap')!.fy2027;
    expect(text).toContain(`gap the city must close $${(Math.abs(gap) / 1e6).toFixed(1)}M`);
  });

  it('has a text alternative: a table of every department, its dollars and its share', () => {
    const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
    expect(table.match(/<th scope="row"/g)).toHaveLength(depts.length);
    for (const d of depts) {
      expect(table).toContain(`$${d.baseline.toLocaleString('en-US')}`);
      expect(table).toContain(`$${((d.baseline / total) * 100).toFixed(2)}`);
    }
  });

  it('keeps the note that the compounding chart is an illustration', () => {
    expect(text).toContain('Illustration: lines show the cited average rates applied to 100, not actual yearly figures.');
    expect(text).toContain("Year-by-year spending for FY22–FY25 isn't in the sources.");
  });

  it('counts its sources from the data', () => {
    const city = b.sources.filter((s) => s.type === 'city').length;
    expect(text).toContain(`${b.sources.length} sources: ${city} city documents, ${b.sources.length - city} news reports`);
  });
});
