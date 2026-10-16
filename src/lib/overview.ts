/**
 * Figures for a city's overview page, all computed from budget.json and the
 * city's editorial groupings (families, revenue groups). Pages render these;
 * nothing numeric is typed into the page.
 */
import type { CityBudget } from '../data/types.ts';
import type { Families } from './families.ts';
import type { Figure } from './receipts.ts';
import type { RevenueGroup } from './revenue-groups.ts';
import { per100 } from './waffle.ts';

export function overview(b: CityBudget, families: Families, revenueGroups: RevenueGroup[]) {
  const fy27 = b.departmentReductions.find((y) => y.year === 'FY2027')!;
  const step = (key: string) => b.deficitBridge.steps.find((s) => s.key === key)!;
  const fte = b.fte.scenarios.find((s) => s.key === 'without-sales-tax')!;
  const shares = per100(fy27.departments, (d) => d.baseline);
  const familyTotals = families.list.map((f) => {
    const members = shares.filter((s) => families.of(s.item.id).id === f.id);
    return { family: f, dollars: members.reduce((a, s) => a + s.squares, 0), exact: members.reduce((a, s) => a + s.exact, 0) };
  });

  // Revenue mix, biggest group first, "Everything else" last.
  const mix = [...revenueGroups].sort((a, b2) => (a.id === 'other' ? 1 : b2.id === 'other' ? -1 : b2.adopted - a.adopted));
  const property = revenueGroups.find((g) => g.id === 'property-tax')!;
  const transfer = revenueGroups.find((g) => g.id === 'transfer-tax')!;

  const adjustments = ['center-street-debt-service', 'parking-funds-stabilization', 'non-departmental'].map(step);
  const waterfall = [
    { key: 'initial', label: 'Initial estimate', value: step('initial-estimate').fy2027, kind: 'total' as const },
    { key: 'revenue', label: 'Revenue came in higher', value: step('revenue-projections').fy2027, kind: 'up' as const },
    { key: 'adjustments', label: 'Three adjustments', value: adjustments.reduce((a, s) => a + s.fy2027, 0), kind: 'cost' as const },
    { key: 'one-time', label: 'One-time money', value: step('one-time-resources').fy2027, kind: 'one-time' as const },
    { key: 'final', label: 'The gap', value: step('final-gap').fy2027, kind: 'total' as const },
  ];

  const g = b.citedFacts.growth;
  const growth = Array.from({ length: g.years + 1 }, (_, year) => ({
    year,
    spending: 100 * (1 + g.spendingRate) ** year,
    revenue: 100 * (1 + g.revenueRate) ** year,
  }));

  const withTax = b.fte.positions.find((p) => p.key === 'with-sales-tax')!;
  const withoutTax = b.fte.positions.find((p) => p.key === 'without-sales-tax')!;
  const sourceCounts = { city: b.sources.filter((s) => s.type === 'city').length, news: b.sources.filter((s) => s.type === 'news').length };

  return {
    shares,
    familyTotals,
    departments: fy27.departments,
    baseline: {
      value: fy27.total.baseline,
      label: 'General Fund department baseline before proposed cuts, FY2027 (planning figure)',
      ref: fy27.total,
    } satisfies Figure,
    fte: {
      value: fte.fy2027BaselineFte,
      label: 'Staff positions (FTE), FY2027 baseline, all funds',
      ref: fte,
      format: 'number',
      tone: 'neutral',
    } satisfies Figure,
    gap: { value: step('final-gap').fy2027, label: 'FY2027 General Fund gap, after adjustments', ref: step('final-gap') } satisfies Figure,
    revenue: {
      mix,
      total: { value: b.revenue.total.fy2026Adopted, label: 'General Fund revenue and transfers, FY2026 adopted', ref: b.revenue.total } satisfies Figure,
      property,
      transfer,
      /** "About 1 in 3 dollars is property tax." */
      oneIn: Math.round(1 / property.share),
    },
    waterfall: waterfall.map((w) => ({
      ...w,
      figure: {
        value: w.value,
        label: `FY2027 deficit bridge: ${w.label.toLowerCase()}`,
        ref: w.key === 'adjustments' ? adjustments[0] : step(
          { initial: 'initial-estimate', revenue: 'revenue-projections', 'one-time': 'one-time-resources', final: 'final-gap' }[w.key as 'initial']),
        ...(w.key === 'adjustments'
          ? { parts: adjustments.map((s) => ({ label: `${s.label.replace(/^Adjustment:\s*/, '')} (row ${s.row})`, value: s.fy2027 })) }
          : {}),
        tone: w.kind === 'one-time' ? 'one-time' : undefined,
      } satisfies Figure,
    })),
    ballot: {
      withTax: { value: withTax.total, label: 'Positions cut if the sales tax passes', ref: withTax, format: 'number', tone: 'one-time' } satisfies Figure,
      withoutTax: { value: withoutTax.total, label: 'Positions cut if the sales tax fails', ref: withoutTax, format: 'number', tone: 'short' } satisfies Figure,
      salesTax: { value: b.citedFacts.salesTax.rate, label: `Proposed local sales tax on the ${b.citedFacts.salesTax.election} ballot`, ref: b.citedFacts.salesTax, format: 'percent', tone: 'neutral' } satisfies Figure,
      bond: { value: b.citedFacts.bond.amount, label: `Proposed infrastructure bond on the ${b.citedFacts.bond.election} ballot`, ref: b.citedFacts.bond, tone: 'neutral' } satisfies Figure,
      election: b.citedFacts.salesTax.election,
    },
    growth: {
      series: growth,
      cited: g,
      figure: { value: g.spendingRate, label: `Average yearly growth in General Fund spending over ${g.years} years (revenue: ${(g.revenueRate * 100).toLocaleString('en-US')}%)`, ref: g, format: 'percent', tone: 'neutral' } satisfies Figure,
    },
    sourceCounts,
    sourceIds: b.sources.map((s) => s.id),
  };
}
