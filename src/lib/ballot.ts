/**
 * Figures for a city's Ballot page. Strictly neutral: both outcomes are built
 * by the same function and rendered by the same template. Election results,
 * when they're in, are a data change in data/cities/{city}/ballot.json.
 */
import type { CityBudget, SourceId } from '../data/types.ts';
import type { Figure } from './receipts.ts';

export type Status = 'pending' | 'passed' | 'failed';
export type Outcome = 'passes' | 'fails';

export interface BallotFile {
  election: string;
  measures: { salesTax: { status: Status; yesShare: number | null }; bond: { status: Status; yesShare: number | null } };
  fireStation: { label: string } & Record<Outcome, { text: string; sources: SourceId[]; quote: string }>;
}

const files = import.meta.glob<BallotFile>('/data/cities/*/*/*/ballot.json', { eager: true, import: 'default' });

export function ballotFileFor(cityPath: string): BallotFile {
  const f = files[`/data/cities${cityPath}ballot.json`];
  if (!f) throw new Error(`${cityPath} has no ballot.json`);
  return f;
}

/** Heading and per-outcome result marks, from the measures' status. */
export function ballotState(file: BallotFile) {
  const status = file.measures.salesTax.status;
  const result: Outcome | null = status === 'passed' ? 'passes' : status === 'failed' ? 'fails' : null;
  return {
    decided: result !== null,
    result,
    eyebrow: result ? 'Election results' : new Date(`${file.election}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    heading: result ? `The sales tax ${status}. Here's what the city's plan says happens now.` : 'On your ballot, and what it changes',
    lede: result
      ? "The city's plan was built in two versions, one for each result. This is the one that now applies, with the other kept for comparison."
      : "Two city measures affect the budget. We don't take a side. This page shows what the city's own plan says happens under each result.",
    bond: file.measures.bond.status,
  };
}

const STATUSES: Status[] = ['pending', 'passed', 'failed'];

/** Throws on a ballot.json the page can't render honestly. */
export function checkBallotFile(file: BallotFile, b: CityBudget, where = 'ballot.json') {
  for (const [k, m] of Object.entries(file.measures)) {
    if (!STATUSES.includes(m.status)) throw new Error(`${where}: ${k}.status must be one of ${STATUSES.join(', ')}, got "${m.status}"`);
  }
  const known = new Set(b.sources.map((s) => s.id));
  for (const o of ['passes', 'fails'] as const) {
    const f = file.fireStation[o];
    if (!f?.text || !f.sources.length) throw new Error(`${where}: fireStation.${o} needs text and sources`);
    for (const id of f.sources) if (!known.has(id)) throw new Error(`${where}: fireStation.${o} cites unknown source ${id}`);
  }
}

export function ballotPage(b: CityBudget, file: BallotFile, short: Record<string, string> = {}) {
  checkBallotFile(file, b);
  const fy27 = b.departmentReductions.find((y) => y.year === 'FY2027')!;
  const t = b.citedFacts.salesTax;
  const bond = b.citedFacts.bond;
  const pos = (k: 'with-sales-tax' | 'without-sales-tax') => b.fte.positions.find((p) => p.key === k)!;
  const fte = (k: 'with-sales-tax' | 'without-sales-tax') => b.fte.scenarios.find((s) => s.key === k)!;
  const bridge = b.oneTimeResources.uses.find((u) => /sales & use tax/i.test(u.label))!;

  // One builder for both outcomes: same fields, same order, same wording.
  const scenario = (outcome: Outcome) => {
    const key = outcome === 'passes' ? 'with-sales-tax' : 'without-sales-tax';
    const p = pos(key);
    const f = fte(key);
    const cuts = outcome === 'passes' ? fy27.total.netReduction : fy27.total.reduction;
    const cutsPct = outcome === 'passes' ? fy27.total.netReductionPct : fy27.total.reductionPct;
    const word = outcome === 'passes' ? 'passes' : 'fails';
    return {
      outcome,
      positions: { total: p.total, vacant: p.vacant, filled: p.filled, figure: { value: p.total, label: `Positions eliminated if the sales tax ${word} (${p.vacant} vacant, ${p.filled} filled)`, ref: p, format: 'number', tone: 'neutral' } satisfies Figure },
      cuts: { value: cuts, pct: cutsPct, figure: { value: cuts, label: `FY2027 department cuts if the sales tax ${word}`, ref: fy27.total, tone: 'short' } satisfies Figure },
      workforce: {
        after: f.fy2027NetFte,
        before: f.fy2026AdoptedFte,
        figure: { value: f.fy2027NetFte, label: `City workforce (FTE) after FY2027 cuts if the sales tax ${word}`, ref: f, format: 'number', tone: 'neutral' } satisfies Figure,
      },
      fireStation: { label: file.fireStation.label, ...file.fireStation[outcome] },
    };
  };
  const scenarios = [scenario('passes'), scenario('fails')];
  const softened = fy27.departments.filter((d) => d.salesTaxAllocation > 0).sort((a, c) => c.salesTaxAllocation - a.salesTaxAllocation);

  return {
    state: ballotState(file),
    salesTax: {
      fact: t,
      figure: { value: t.rate, label: `Proposed local sales tax, ${t.election} ballot`, ref: t, format: 'percent', tone: 'neutral' } satisfies Figure,
      bridge: { value: bridge.amount, label: 'One-time money set aside as the sales-tax bridge, FY2027-28', ref: bridge, tone: 'one-time' } satisfies Figure,
    },
    bond: {
      fact: bond,
      figure: { value: bond.amount, label: `Proposed infrastructure bond, ${bond.election} ballot`, ref: bond, tone: 'neutral' } satisfies Figure,
      backlog: { value: b.citedFacts.backlog.low, label: 'Unfunded infrastructure and deferred maintenance, low estimate', ref: b.citedFacts.backlog, tone: 'neutral' } satisfies Figure,
    },
    scenarios,
    /** Same scale for both pictograms: the larger layoff count, rounded up to a full row of 20. */
    pictogramSlots: Math.ceil(Math.max(...scenarios.map((s) => s.positions.filled)) / 20) * 20,
    softened: softened.map((d) => short[d.id] ?? d.name),
    plan: b.sources.find((s) => s.id === 'S1')!,
  };
}
