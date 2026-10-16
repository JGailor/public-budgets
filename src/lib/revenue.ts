/**
 * Figures for a city's Revenue page: the FY2026 mix by group, every line item
 * with its mid-year pace and change on last year, and the insight cards. All
 * from budget.json and revenue-groups.json.
 */
import type { CityBudget, RevenueLine } from '../data/types.ts';
import type { Figure } from './receipts.ts';
import type { RevenueGroup } from './revenue-groups.ts';

export const SORTS = ['biggest', 'fastest', 'az'] as const;
export type Sort = (typeof SORTS)[number];
/** Rows shown before "Show all". */
export const VISIBLE = 14;

export type Pace = 'behind' | 'on-pace' | 'ahead';
/** Under 40% received by mid-year is behind, 40–60% on pace, over 60% ahead. */
export const pace = (p: number | null): Pace => (p === null || p < 0.4 ? 'behind' : p <= 0.6 ? 'on-pace' : 'ahead');

export function revenuePage(b: CityBudget, groups: RevenueGroup[]) {
  const rev = b.revenue;
  const line = (name: string) => {
    const l = rev.lines.find((x) => x.name === name);
    if (!l) throw new Error(`revenue page: no line "${name}" in GF Revenue FY26`);
    return l;
  };
  const figure = (l: RevenueLine) => ({
    adopted: { value: l.fy2026Adopted, label: `${l.name}: FY2026 adopted budget`, ref: l } satisfies Figure,
    received: { value: l.pctOfAdoptedReceived ?? 0, label: `${l.name}: share of the FY2026 budget received by mid-year`, ref: l, format: 'percent', tone: 'neutral' } satisfies Figure,
    change: {
      value: l.changeVsFy2025Pct ?? 0,
      label: `${l.name}: mid-year receipts vs FY2025 mid-year`,
      ref: l,
      format: 'percent',
      tone: 'neutral',
    } satisfies Figure,
  });

  const lines = rev.lines.map((l) => ({ l, pace: pace(l.pctOfAdoptedReceived), figures: figure(l) }));
  const ranked: Record<Sort, string[]> = {
    biggest: [...rev.lines].sort((a, c) => c.fy2026Adopted - a.fy2026Adopted).map((l) => l.name),
    // Fastest growing: biggest change on last year first; a line with no FY2025 figure goes last.
    fastest: [...rev.lines]
      .sort((a, c) => (c.changeVsFy2025Pct ?? -Infinity) - (a.changeVsFy2025Pct ?? -Infinity) || c.fy2026Adopted - a.fy2026Adopted)
      .map((l) => l.name),
    az: [...rev.lines].sort((a, c) => a.name.localeCompare(c.name)).map((l) => l.name),
  };
  const rank = (name: string) => Object.fromEntries(SORTS.map((s) => [s, ranked[s].indexOf(name)])) as Record<Sort, number>;

  const mix = [...groups].sort((a, c) => (a.id === 'other' ? 1 : c.id === 'other' ? -1 : c.adopted - a.adopted));
  let before = 0;
  const mixBlocks = mix.map((g) => {
    const start = before;
    before += g.share;
    return { g, start };
  });

  const transfer = line('Property Transfer Tax');
  const measureP = line('Property Transfer Tax — Measure P');
  const blt = line('Business License Tax');
  const transfers = line('Transfers');
  const property = groups.find((g) => g.id === 'property-tax')!;

  return {
    total: { value: rev.total.fy2026Adopted, label: 'General Fund revenue and transfers, FY2026 adopted', ref: rev.total } satisfies Figure,
    received: rev.total.pctOfAdoptedReceived ?? 0,
    totalPace: pace(rev.total.pctOfAdoptedReceived),
    lineCount: rev.lines.length,
    mix: mixBlocks,
    property,
    lines: lines.map((x) => ({ ...x, rank: rank(x.l.name) })),
    max: Math.max(...rev.lines.map((l) => l.fy2026Adopted)),
    insights: {
      transfer: { line: transfer, measureP, figure: figure(transfer).change, measurePFigure: figure(measureP).change },
      timing: { line: blt, figure: figure(blt).received },
      transfers: {
        line: transfers,
        figure: {
          value: transfers.fy2026MidYearActual,
          label: 'Transfers in, received by mid-year FY2026',
          ref: transfers,
          tone: 'one-time',
          parts: [
            { label: 'FY2025 mid-year', value: transfers.fy2025MidYearActual },
            { label: 'Increase', value: transfers.changeVsFy2025 },
          ],
        } satisfies Figure,
      },
    },
  };
}
