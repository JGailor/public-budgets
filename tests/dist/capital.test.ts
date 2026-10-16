import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityBudget } from '../../src/data/types';

const root = join(import.meta.dirname, '../..');
const b: CityBudget = JSON.parse(readFileSync(join(root, 'data/cities/us/ca/berkeley/budget.json'), 'utf8'));
const html = readFileSync(join(root, 'dist/us/ca/berkeley/capital/index.html'), 'utf8');
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const lines = b.capitalProgram.lines;
const m = (v: number) => `$${(v / 1e6).toFixed(1)}M`;

describe('capital page (built)', () => {
  it('the total is $178,597,581; the General Fund block is $24.2M', () => {
    const total = lines.reduce((a, l) => a + l.total, 0);
    expect(total).toBe(178_597_581);
    expect(b.capitalProgram.total.total).toBe(total);
    const gf = lines.filter((l) => l.category === 'GF/CIP');
    const gfTotal = gf.reduce((a, l) => a + l.total, 0);
    expect(m(gfTotal)).toBe('$24.2M');
    expect(text).toContain(`${m(total)} planned FY27-28`);
    expect(text).toContain(`General Fund (${gf.length} programs) ${m(gfTotal)}`);
    expect(text).toContain(`Only the red block comes from the General Fund (${m(gfTotal)})`);
  });

  it('draws each block with an area matching its value (wide layout)', () => {
    const blocks = [...html.matchAll(/<li class="tb"[^>]*style="([^"]*)"[^>]*>\s*<span class="tb-name"[^>]*>([^<]*)<\/span>\s*<span class="tb-value[^>]*>([^<]*)</g)];
    expect(blocks.length).toBeGreaterThan(10);
    let area = 0;
    for (const [, style, name, value] of blocks) {
      const v = (k: string) => Number(style.match(new RegExp(`--wide-${k}:([\\d.]+)%`))![1]);
      area += v('w') * v('h');
      const line = lines.find((l) => l.name === name.replace(/&amp;/g, '&'));
      if (line) {
        expect(value.trim()).toBe(m(line.total));
        expect((v('w') * v('h')) / 1e4).toBeCloseTo(line.total / 178_597_581, 4);
      }
    }
    expect(area / 1e4).toBeCloseTo(1, 4);
  });

  it('shows the backlog range and the asset inventory', () => {
    expect(text).toContain('$1.65–2B estimated unfunded need: 300+ miles of sidewalk, 54 parks, 95 buildings');
  });
});
