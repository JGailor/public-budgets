import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { budgetFor } from '../../src/lib/budget';
import { capitalGroupsFor, capitalPage, contrast, LAYOUTS, squarify } from '../../src/lib/capital';
import { cities } from '../../src/lib/cities';

const city = cities[0];
const budget = budgetFor(city)!;
const groups = capitalGroupsFor(city.path);
const c = capitalPage(budget, groups);

describe('capital page figures', () => {
  it('the total is $178,597,581; the General Fund block is $24.2M', () => {
    expect(c.total.value).toBe(178_597_581);
    expect(c.generalFund.name).toBe('General Fund (6 programs)');
    expect((c.generalFund.value / 1e6).toFixed(1)).toBe('24.2');
    expect(c.generalFund.figure.parts!.reduce((a, p) => a + p.value, 0)).toBe(c.generalFund.value);
  });

  it('the General Fund block is the only red', () => {
    const red = c.blocks.filter((b) => b.color === c.generalFund.color);
    expect(red.map((b) => b.id)).toEqual(['general-fund']);
  });

  it('"Other sources (n)" counts what it rolled up: every source under 1% of the total', () => {
    const small = budget.capitalProgram.lines.filter((l) => !l.category.startsWith('GF') && l.total / c.total.value < 0.01);
    const other = c.blocks.at(-1)!;
    expect(other.name).toBe(`Other sources (${small.length})`);
    expect(small.length).toBe(7);
    expect(other.value).toBe(small.reduce((a, l) => a + l.total, 0));
  });

  it('every dollar is in exactly one block', () => {
    expect(c.blocks.reduce((a, b) => a + b.value, 0)).toBe(c.total.value);
    const names = c.blocks.flatMap((b) => b.lines.map((l) => l.name));
    expect(new Set(names).size).toBe(budget.capitalProgram.lines.length);
  });

  for (const k of ['wide', 'tall'] as const) {
    it(`the ${k} treemap tiles its box exactly, with area proportional to value`, () => {
      const area = c.blocks.reduce((a, b) => a + b.rect[k].w * b.rect[k].h, 0);
      expect(area).toBeCloseTo(100 * 100, 6);
      for (const b of c.blocks) {
        expect((b.rect[k].w * b.rect[k].h) / 1e4).toBeCloseTo(b.value / c.total.value, 9);
        expect(b.rect[k].x + b.rect[k].w).toBeLessThanOrEqual(100 + 1e-9);
        expect(b.rect[k].y + b.rect[k].h).toBeLessThanOrEqual(100 + 1e-9);
      }
      for (const [i, a] of c.blocks.entries())
        for (const b of c.blocks.slice(i + 1)) {
          const ra = a.rect[k];
          const rb = b.rect[k];
          const overlap = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x) > 1e-6 && Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y) > 1e-6;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
    });
  }

  it('squarify keeps blocks squarish (worst aspect under 4:1 here)', () => {
    const rects = squarify(c.blocks.map((b) => b.value), LAYOUTS.wide.w, LAYOUTS.wide.h);
    for (const r of rects.slice(0, -1)) expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(4);
  });

  it('every block label meets 4.5:1 on its color', () => {
    for (const b of c.blocks) expect(contrast(b.text, b.color), b.id).toBeGreaterThanOrEqual(4.5);
  });

  it('a fund category with no legend group fails the build', () => {
    const missing = { ...groups, groups: groups.groups.filter((g) => g.id !== 'grants') };
    expect(() => capitalPage(budget, missing)).toThrow(/no group for Grant/);
  });

  it('the scale and the inventory come from the cited backlog', () => {
    expect(c.scale.program).toBeCloseTo(178_597_581 / 2e9, 9);
    expect(c.scale.low).toBeCloseTo(0.825, 9);
    expect(c.backlog.fact).toMatchObject({ sidewalkMiles: '300+', parks: 54, buildings: 95 });
  });

  it('has no figure typed into the page', () => {
    const src = readFileSync(join(import.meta.dirname, '../../src/pages/[country]/[state]/[city]/capital.astro'), 'utf8');
    for (const lit of ['178', '24.2', '1.65', '300+', ' 54 ', ' 95 ', '$29M', '48.1', 'Sanitary']) expect(src, lit).not.toContain(lit);
  });
});
